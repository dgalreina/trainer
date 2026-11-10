import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

/** Curva de salida suave (cúbica): arranca rápido y frena al llegar, como el deslizamiento de las pestañas. */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Valor que se acerca poco a poco a `target` cada vez que este cambia. Con «reducir movimiento» salta
 * directamente. Sirve para animar medidas (como la altura de las ondas) sin depender del navegador.
 */
export function useSmoothValue(target: number, durationMs = 380): number {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    if (reduceMotion || durationMs <= 0) {
      current.current = target;
      setValue(target);
      return;
    }
    const from = current.current;
    if (from === target) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(Math.max((now - start) / durationMs, 0), 1);
      current.current = from + (target - from) * easeOutCubic(t);
      setValue(current.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, reduceMotion]);

  return value;
}
