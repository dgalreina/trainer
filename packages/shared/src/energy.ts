// Balance de energía de un día: lo que se gasta y lo que se come, repartido en tramos de 15 minutos.
// Lo calcula el código (nunca la IA) y alimenta las gráficas del calendario.

/** Minutos de cada tramo en que se reparte el día. */
export const ENERGY_SLOT_MINUTES = 15;
export const ENERGY_SLOTS = (24 * 60) / ENERGY_SLOT_MINUTES;
/** Equivalente metabólico de un entreno de pesas (orientativo: no medimos las calorías quemadas). */
export const WORKOUT_MET = 5;
/** Una comida se reparte a lo largo de este rato, desde su hora (no es instantánea). */
export const MEAL_SPREAD_MINUTES = 30;

/**
 * Parte del nivel que se «olvida» en cada tramo: con 24 h de constante de tiempo. Así el nivel no crece sin límite en
 * una racha de superávit y, al encadenar varios días, lo que había hace una semana ya no pesa (no hace falta saber dónde empezó).
 */
export const LEVEL_LEAK_PER_SLOT = ENERGY_SLOT_MINUTES / (24 * 60);

const SLOT_MS = ENERGY_SLOT_MINUTES * 60_000;
const MEAL_SPREAD_MS = MEAL_SPREAD_MINUTES * 60_000;
const DAY_MS = 24 * 3_600_000;

/** Un entreno, con instantes en milisegundos. */
export interface EnergyWorkout {
  start: number;
  end: number;
}

/** Una comida (registrada o de la dieta que se da por comida), con su hora en milisegundos. */
export interface EnergyMeal {
  at: number;
  kcal: number;
}

export interface DayEnergyInput {
  /** Inicio del día (00:00 en la hora del dispositivo), en milisegundos. */
  dayStart: number;
  /** Metabolismo basal diario (kcal); sin él no se conoce el gasto. */
  bmr: number | null;
  /** Último peso (kg); sin él no se puede estimar lo que gasta un entreno. */
  weightKg: number | null;
  workouts: EnergyWorkout[];
  meals: EnergyMeal[];
  /** Nivel con el que empieza el día (kcal): el que dejó el día anterior. Sin él, 0. */
  startLevel?: number;
}

export interface DayEnergy {
  /** Si hay datos para conocer el gasto (el basal). Sin ellos solo hay consumo. */
  hasBurn: boolean;
  /** Gasto de cada tramo (kcal): basal más entrenos. */
  burn: number[];
  /** Lo comido en cada tramo (kcal). */
  intake: number[];
  /** Balance acumulado desde las 00:00 hasta el final de cada tramo (consumo − gasto, kcal). Solo cuenta este día. */
  balance: number[];
  /**
   * Nivel de energía al final de cada tramo (kcal): sigue de un día al siguiente (a medianoche no vuelve a 0),
   * cada comida lo sube, el gasto lo baja y tiende despacio a 0 ({@link LEVEL_LEAK_PER_SLOT}). Es lo que se dibuja.
   */
  level: number[];
  totals: {
    basal: number;
    workouts: number;
    burn: number;
    intake: number;
    balance: number;
  };
}

/** Calorías que gasta un entreno por encima del basal (que ya cuenta aparte): (MET − 1) × kg × horas. */
export function workoutExtraKcal(weightKg: number, minutes: number, met = WORKOUT_MET): number {
  return Math.max(0, (met - 1) * weightKg * (minutes / 60));
}

/**
 * Reparte `kcal` entre los tramos que cubre [start, end), en proporción al solape, y devuelve lo que
 * ha caído de verdad dentro del día (un entreno que cruza la medianoche reparte solo su parte).
 */
function spread(slots: number[], dayStart: number, start: number, end: number, kcal: number): number {
  if (!(kcal > 0) || !Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const lastSlot = slots.length - 1;
  if (end <= start) {
    const index = Math.min(Math.max(Math.floor((start - dayStart) / SLOT_MS), 0), lastSlot);
    slots[index] += kcal;
    return kcal;
  }
  const total = end - start;
  const first = Math.max(0, Math.floor((start - dayStart) / SLOT_MS));
  const last = Math.min(lastSlot, Math.floor((end - 1 - dayStart) / SLOT_MS));
  let placed = 0;
  for (let i = first; i <= last; i++) {
    const from = Math.max(start, dayStart + i * SLOT_MS);
    const to = Math.min(end, dayStart + (i + 1) * SLOT_MS);
    if (to > from) {
      const part = (kcal * (to - from)) / total;
      slots[i] += part;
      placed += part;
    }
  }
  return placed;
}

/**
 * Gasto, consumo y balance acumulado de un día. El gasto es el basal repartido por igual más lo que
 * suman los entrenos; el consumo, cada comida repartida en {@link MEAL_SPREAD_MINUTES}. Un entreno
 * o una comida fuera del día no cuenta. El día se trata como 24 h fijas (96 tramos): el día del cambio
 * de hora, lo de después de las 23:00 locales queda ±1 h desplazado (igual que las tarjetas del calendario).
 */
export function dayEnergy({ dayStart, bmr, weightKg, workouts, meals, startLevel = 0 }: DayEnergyInput): DayEnergy {
  const hasBurn = bmr !== null && bmr > 0;
  const basalPerSlot = hasBurn ? bmr / ENERGY_SLOTS : 0;
  const burn = Array.from({ length: ENERGY_SLOTS }, () => basalPerSlot);
  const intake = Array.from({ length: ENERGY_SLOTS }, () => 0);

  let workoutsKcal = 0;
  if (hasBurn && weightKg !== null && weightKg > 0) {
    for (const workout of workouts) {
      const extra = workoutExtraKcal(weightKg, (workout.end - workout.start) / 60_000);
      workoutsKcal += spread(burn, dayStart, workout.start, workout.end, extra);
    }
  }
  for (const meal of meals) {
    // La ventana de la comida se ajusta para caber en el día: así lo comido a última hora no se pierde.
    const start = Math.min(Math.max(meal.at, dayStart), dayStart + DAY_MS - MEAL_SPREAD_MS);
    spread(intake, dayStart, start, start + MEAL_SPREAD_MS, meal.kcal);
  }

  let running = 0;
  const balance = intake.map((eaten, i) => (running += eaten - burn[i]));

  let carried = startLevel;
  const level = intake.map((eaten, i) => (carried = carried * (1 - LEVEL_LEAK_PER_SLOT) + eaten - burn[i]));

  const sum = (list: number[]) => list.reduce((total, value) => total + value, 0);
  return {
    hasBurn,
    burn,
    intake,
    balance,
    level,
    totals: {
      basal: Math.round(basalPerSlot * ENERGY_SLOTS),
      workouts: Math.round(workoutsKcal),
      burn: Math.round(sum(burn)),
      intake: Math.round(sum(intake)),
      balance: Math.round(running),
    },
  };
}

/** Cómo va el día respecto a lo que se gasta: en déficit, en mantenimiento o en superávit. */
export type BalanceZone = "deficit" | "maintenance" | "surplus";

/** Mínimo de la banda de mantenimiento (kcal): por debajo de esto no se habla de déficit ni de superávit. */
export const MAINTENANCE_MIN_BAND = 100;
/** Fracción del gasto del día que se tolera como mantenimiento (±5 %). */
export const MAINTENANCE_BAND_FRACTION = 0.05;

/** Media anchura (kcal) de la banda de mantenimiento: ±5 % del gasto del día, y nunca menos de 100. */
export function maintenanceBand(burn: number): number {
  return Math.max(MAINTENANCE_MIN_BAND, Math.round(burn * MAINTENANCE_BAND_FRACTION));
}

/** En qué zona está un balance (consumo − gasto) dado el gasto del día. */
export function balanceZone(balance: number, burn: number): BalanceZone {
  const band = maintenanceBand(burn);
  return balance < -band ? "deficit" : balance > band ? "surplus" : "maintenance";
}
