/**
 * Superseries: un ejercicio con técnica `ss` va encadenado con el SIGUIENTE; la cadena sigue mientras el ejercicio
 * tenga `ss`. Se dibujan como en zitytraining: un bloque con un filo grueso a la izquierda, ejercicios numerados 1a, 1b…
 * (los normales, 1, 2, 3…) y entre cada par una pequeña marca «SUPERSERIE».
 */

interface Chainable {
  technique?: string;
}

/** Una cadena de ejercicios (de 1 = ejercicio normal; de 2 o más = superserie) con su posición original. */
export interface ChainBlock<T> {
  item: T;
  index: number;
}

/** Agrupa los ejercicios consecutivos encadenados en bloques. */
export function chainBlocks<T extends Chainable>(items: T[]): ChainBlock<T>[][] {
  const blocks: ChainBlock<T>[][] = [];
  let i = 0;
  while (i < items.length) {
    const block: ChainBlock<T>[] = [{ item: items[i], index: i }];
    // Cada `ss` arrastra al siguiente ejercicio (si existe) al mismo bloque.
    while (items[i].technique === 'ss' && i + 1 < items.length) {
      i++;
      block.push({ item: items[i], index: i });
    }
    blocks.push(block);
    i++;
  }
  return blocks;
}

/** Etiquetas de cada ejercicio, en el orden original: «1», «2», «3a», «3b»… */
export function chainLabels<T extends Chainable>(items: T[]): string[] {
  const labels: string[] = new Array(items.length);
  chainBlocks(items).forEach((block, n) => {
    block.forEach(({ index }, k) => {
      labels[index] = block.length === 1 ? String(n + 1) : `${n + 1}${String.fromCharCode(97 + k)}`;
    });
  });
  return labels;
}

/** Si el ejercicio forma parte de una superserie, y si le sigue otro de la misma cadena. */
export function chainPosition<T extends Chainable>(
  items: T[],
  index: number,
): { inChain: boolean; hasNext: boolean } {
  const hasNext = items[index]?.technique === 'ss' && index + 1 < items.length;
  const hasPrev = index > 0 && items[index - 1]?.technique === 'ss';
  return { inChain: hasNext || hasPrev, hasNext };
}
