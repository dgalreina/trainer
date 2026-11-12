// Cómo cambia el peso frente a lo que dicen las calorías. Lo calcula el código (nunca la IA).
//
// Un día suelto no sirve (el peso varía 1-2 kg por agua, sal, comida sin digerir…), así que se compara por semanas: el peso
// medio de cada semana (lunes a domingo) frente al balance (comido − gastado) de los días entre un centro de semana y el
// siguiente. Unos 7700 kcal de superávit equivalen a 1 kg. Con varias semanas también se estima el gasto real.

/** Kcal de un kg de peso (regla general, orientativa). */
export const KCAL_PER_KG = 7700;
/** Un tramo cuenta si al menos esta parte de sus días tienen comidas registradas. */
const MIN_COUNTED_FRACTION = 0.6;
/** Mínimo de días entre la primera y la última semana para estimar el gasto real. */
const MIN_CALIBRATION_DAYS = 14;

const DAY_MS = 86_400_000;
const toUtc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** Suma `n` días a un día "AAAA-MM-DD" (sin husos horarios). */
export const addIsoDays = (iso: string, n: number): string => new Date(toUtc(iso) + n * DAY_MS).toISOString().slice(0, 10);
/** Lunes de la semana de un día "AAAA-MM-DD". */
export const mondayOfIso = (iso: string): string => addIsoDays(iso, -((new Date(toUtc(iso)).getUTCDay() + 6) % 7));
const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / DAY_MS);

/** Lo que el código sabe de un día ya terminado. */
export interface TrendDay {
  day: string;
  /** Comido − gastado (kcal) según la app. */
  balance: number;
  intake: number;
  /** Gasto que calcula la app (basal + entrenos). */
  burn: number;
  /** Con comidas registradas (o de la dieta): un día sin nada no cuenta, no es un día de ayuno. */
  counted: boolean;
}

export interface TrendWeek {
  /** Lunes de la semana. */
  monday: string;
  /** Peso medio de las pesadas de la semana; null si no hay. */
  avgKg: number | null;
  weighIns: number;
  /** Días de la semana (ya terminados) con comidas registradas. */
  countedDays: number;
  /** Cuánto ha cambiado el peso medio respecto a la semana anterior con peso; null si no hay con qué comparar. */
  deltaKg: number | null;
  /** Lo que predicen las kcal para ese mismo cambio (balance entre los dos centros de semana ÷ 7700); null si faltan días. */
  predictedDeltaKg: number | null;
  /** Balance de los días de esa comparación (kcal). */
  balanceKcal: number | null;
}

export interface WeightPoint {
  monday: string;
  avgKg: number;
  /** El peso que daría partir de la primera semana y sumar lo que dicen las kcal; null si faltan días. */
  predictedKg: number | null;
}

export interface Calibration {
  days: number;
  weeks: number;
  deltaKg: number;
  avgIntake: number;
  /** Gasto medio que calcula la app (basal + entrenos). */
  modeledBurn: number;
  /** Gasto medio que explica el cambio de peso: lo comido menos lo que el peso dice que has acumulado. */
  realBurn: number;
  /** realBurn − modeledBurn: lo que falta por moverte, digerir… */
  extraBurn: number;
  confidence: "baja" | "media" | "alta";
}

export interface WeightTrend {
  weeks: TrendWeek[];
  points: WeightPoint[];
  calibration: Calibration | null;
}

const centerOf = (monday: string) => addIsoDays(monday, 3);

/** Balance de los días entre dos centros (excluido el primero): los días contados, extrapolados a todos los del tramo. */
function spanBalance(days: Map<string, TrendDay>, fromCenter: string, toCenter: string): { total: number } | null {
  const length = daysBetween(fromCenter, toCenter);
  if (length <= 0) return null;
  let sum = 0;
  let counted = 0;
  for (let i = 1; i <= length; i++) {
    const d = days.get(addIsoDays(fromCenter, i));
    if (d?.counted) {
      sum += d.balance;
      counted++;
    }
  }
  if (counted < length * MIN_COUNTED_FRACTION) return null;
  return { total: (sum / counted) * length };
}

export function weightTrend({
  weights,
  days,
  kcalPerKg = KCAL_PER_KG,
}: {
  weights: { day: string; weightKg: number }[];
  days: TrendDay[];
  kcalPerKg?: number;
}): WeightTrend {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const all = [...weights.map((w) => w.day), ...days.map((d) => d.day)].sort();
  if (all.length === 0) return { weeks: [], points: [], calibration: null };

  const weeks: TrendWeek[] = [];
  for (let monday = mondayOfIso(all[0]); monday <= all[all.length - 1]; monday = addIsoDays(monday, 7)) {
    const inWeek = weights.filter((w) => w.day >= monday && w.day < addIsoDays(monday, 7));
    const avgKg = inWeek.length ? inWeek.reduce((t, w) => t + w.weightKg, 0) / inWeek.length : null;
    const countedDays = days.filter((d) => d.counted && d.day >= monday && d.day < addIsoDays(monday, 7)).length;
    weeks.push({ monday, avgKg, weighIns: inWeek.length, countedDays, deltaKg: null, predictedDeltaKg: null, balanceKcal: null });
  }

  // Cada semana con peso se compara con la anterior que también lo tiene.
  let previous: TrendWeek | null = null;
  for (const week of weeks) {
    if (week.avgKg === null) continue;
    if (previous && previous.avgKg !== null) {
      week.deltaKg = week.avgKg - previous.avgKg;
      const span = spanBalance(byDay, centerOf(previous.monday), centerOf(week.monday));
      if (span) {
        week.balanceKcal = Math.round(span.total);
        week.predictedDeltaKg = span.total / kcalPerKg;
      }
    }
    previous = week;
  }

  const weighed = weeks.filter((w): w is TrendWeek & { avgKg: number } => w.avgKg !== null);
  const points: WeightPoint[] = weighed.map((week) => {
    const first = weighed[0];
    const span = week === first ? { total: 0 } : spanBalance(byDay, centerOf(first.monday), centerOf(week.monday));
    return { monday: week.monday, avgKg: week.avgKg, predictedKg: span ? first.avgKg + span.total / kcalPerKg : null };
  });

  // Gasto real: lo comido menos lo que el peso dice que se ha acumulado entre la primera y la última semana con peso.
  let calibration: Calibration | null = null;
  if (weighed.length >= 2) {
    const first = weighed[0];
    const last = weighed[weighed.length - 1];
    const from = centerOf(first.monday);
    const length = daysBetween(from, centerOf(last.monday));
    if (length >= MIN_CALIBRATION_DAYS) {
      const counted: TrendDay[] = [];
      for (let i = 1; i <= length; i++) {
        const d = byDay.get(addIsoDays(from, i));
        if (d?.counted) counted.push(d);
      }
      if (counted.length >= length * MIN_COUNTED_FRACTION) {
        const mean = (pick: (d: TrendDay) => number) => counted.reduce((t, d) => t + pick(d), 0) / counted.length;
        const avgIntake = mean((d) => d.intake);
        const modeledBurn = mean((d) => d.burn);
        const deltaKg = last.avgKg - first.avgKg;
        const realBurn = avgIntake - (deltaKg * kcalPerKg) / length;
        // Un resultado fuera de lo razonable es ruido (pesadas muy dispares, días sin registrar…): no se da.
        if (realBurn >= 1000 && realBurn <= 6000) {
          calibration = {
            days: length,
            weeks: weighed.length,
            deltaKg,
            avgIntake: Math.round(avgIntake),
            modeledBurn: Math.round(modeledBurn),
            realBurn: Math.round(realBurn),
            extraBurn: Math.round(realBurn - modeledBurn),
            confidence: length >= 35 ? "alta" : length >= 21 ? "media" : "baja",
          };
        }
      }
    }
  }

  return { weeks, points, calibration };
}
