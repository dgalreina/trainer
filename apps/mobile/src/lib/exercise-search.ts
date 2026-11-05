import { exerciseNameKey, type Exercise } from '@trainer/shared';

/** Palabras que no ayudan a encontrar un ejercicio («press de banca» = «press banca»). */
const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'con', 'en', 'a', 'al', 'y']);

const words = (text: string) =>
  exerciseNameKey(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOPWORDS.has(w));

/** Distancia de edición entre dos palabras cortas (cambiar, quitar o añadir una letra cuenta 1). */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** Cuántas letras puede tener mal una palabra buscada: ninguna si es muy corta. */
const tolerance = (word: string) => (word.length <= 3 ? 0 : word.length <= 6 ? 1 : 2);

/** 0 = no coincide, 2 = coincide tal cual (o por el principio), 1 = coincide con una errata. */
function wordScore(query: string, word: string): 0 | 1 | 2 {
  if (word.startsWith(query) || word.includes(query)) return 2;
  const tol = tolerance(query);
  if (tol === 0) return 0;
  // Se compara con la palabra entera y con su principio: «pres» vale para «press» mientras se escribe.
  if (distance(query, word) <= tol || distance(query, word.slice(0, query.length)) <= tol) return 1;
  return 0;
}

/**
 * Busca ejercicios por lo escrito, perdonando erratas y palabras sueltas: «presa banca» encuentra
 * «Press de banca con barra». Todas las palabras escritas tienen que aparecer; salen antes los
 * que coinciden exactamente.
 */
export function searchExercises(exercises: Exercise[], query: string, limit = 8): Exercise[] {
  const wanted = words(query);
  if (wanted.length === 0) return [];
  const scored: { exercise: Exercise; score: number }[] = [];
  for (const exercise of exercises) {
    const own = words(exercise.name);
    let score = 0;
    let all = true;
    for (const w of wanted) {
      const best = Math.max(...own.map((o) => wordScore(w, o)), 0);
      if (best === 0) {
        all = false;
        break;
      }
      score += best;
    }
    if (all) scored.push({ exercise, score });
  }
  scored.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name));
  return scored.slice(0, limit).map((s) => s.exercise);
}
