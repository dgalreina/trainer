import { exerciseNameKey } from '@trainer/shared';
import type { ImageSourcePropType } from 'react-native';

/** Las dos posiciones de un ejercicio: la de inicio y la final. */
export type ExerciseFrames = [ImageSourcePropType, ImageSourcePropType];

// Ilustraciones por nombre de ejercicio (normalizado). Se generan con OpenAI a partir de las fotos
// de free-exercise-db (dominio público) y se guardan en `assets/exercises/<nombre>_0.webp` y `_1.webp`.
const FRAMES: Record<string, ExerciseFrames> = {
  'press de banca con barra': [
    require('../../assets/exercises/press-de-banca-con-barra_0.webp'),
    require('../../assets/exercises/press-de-banca-con-barra_1.webp'),
  ],
  'press de banca con mancuernas': [
    require('../../assets/exercises/press-de-banca-con-mancuernas_0.webp'),
    require('../../assets/exercises/press-de-banca-con-mancuernas_1.webp'),
  ],
  'fondos en paralelas': [
    require('../../assets/exercises/fondos-en-paralelas_0.webp'),
    require('../../assets/exercises/fondos-en-paralelas_1.webp'),
  ],
  'press de banca con agarre cerrado': [
    require('../../assets/exercises/press-de-banca-con-agarre-cerrado_0.webp'),
    require('../../assets/exercises/press-de-banca-con-agarre-cerrado_1.webp'),
  ],
};

/** Las imágenes de un ejercicio, si ya las tiene. */
export const exerciseFrames = (name: string): ExerciseFrames | undefined => FRAMES[exerciseNameKey(name)];
