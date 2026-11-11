import { createContext, useContext } from 'react';

/** Lo que un contenido (por ejemplo, un arrastre para reordenar) necesita saber y hacer con el scroll de su pantalla. */
export interface ScrollControl {
  /** Posición actual del scroll y tamaños del área visible y del contenido. */
  getMetrics: () => { y: number; view: number; content: number };
  /** Desplaza el scroll a esa posición, sin animación. */
  scrollTo: (y: number) => void;
  /** Zona de la pantalla (coordenadas de ventana) que ocupa el área visible del scroll. */
  measureViewport: () => Promise<{ top: number; bottom: number } | null>;
}

export const ScrollControlContext = createContext<ScrollControl | null>(null);

/** El control del scroll de la pantalla, o null si el contenido no está dentro de una pantalla con scroll. */
export const useScrollControl = () => useContext(ScrollControlContext);
