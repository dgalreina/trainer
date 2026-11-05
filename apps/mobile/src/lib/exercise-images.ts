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
  'aperturas con mancuernas': [
    require('../../assets/exercises/aperturas-con-mancuernas_0.webp'),
    require('../../assets/exercises/aperturas-con-mancuernas_1.webp'),
  ],
  'aperturas inclinadas con mancuernas': [
    require('../../assets/exercises/aperturas-inclinadas-con-mancuernas_0.webp'),
    require('../../assets/exercises/aperturas-inclinadas-con-mancuernas_1.webp'),
  ],
  'contractora (pec deck)': [
    require('../../assets/exercises/contractora-pec-deck_0.webp'),
    require('../../assets/exercises/contractora-pec-deck_1.webp'),
  ],
  'cruces en polea (cable crossover)': [
    require('../../assets/exercises/cruces-en-polea-cable-crossover_0.webp'),
    require('../../assets/exercises/cruces-en-polea-cable-crossover_1.webp'),
  ],
  'flexiones de brazos': [
    require('../../assets/exercises/flexiones-de-brazos_0.webp'),
    require('../../assets/exercises/flexiones-de-brazos_1.webp'),
  ],
  'flexiones diamante': [
    require('../../assets/exercises/flexiones-diamante_0.webp'),
    require('../../assets/exercises/flexiones-diamante_1.webp'),
  ],
  'press de banca declinado con barra': [
    require('../../assets/exercises/press-de-banca-declinado-con-barra_0.webp'),
    require('../../assets/exercises/press-de-banca-declinado-con-barra_1.webp'),
  ],
  'press de banca declinado con mancuernas': [
    require('../../assets/exercises/press-de-banca-declinado-con-mancuernas_0.webp'),
    require('../../assets/exercises/press-de-banca-declinado-con-mancuernas_1.webp'),
  ],
  'press de banca en maquina smith': [
    require('../../assets/exercises/press-de-banca-en-maquina-smith_0.webp'),
    require('../../assets/exercises/press-de-banca-en-maquina-smith_1.webp'),
  ],
  'press de banca inclinado con barra': [
    require('../../assets/exercises/press-de-banca-inclinado-con-barra_0.webp'),
    require('../../assets/exercises/press-de-banca-inclinado-con-barra_1.webp'),
  ],
  'press de banca inclinado con mancuernas': [
    require('../../assets/exercises/press-de-banca-inclinado-con-mancuernas_0.webp'),
    require('../../assets/exercises/press-de-banca-inclinado-con-mancuernas_1.webp'),
  ],
  'press en maquina': [
    require('../../assets/exercises/press-en-maquina_0.webp'),
    require('../../assets/exercises/press-en-maquina_1.webp'),
  ],
  'pullover con mancuerna': [
    require('../../assets/exercises/pullover-con-mancuerna_0.webp'),
    require('../../assets/exercises/pullover-con-mancuerna_1.webp'),
  ],
  'buenos dias': [
    require('../../assets/exercises/buenos-dias_0.webp'),
    require('../../assets/exercises/buenos-dias_1.webp'),
  ],
  'dominadas': [
    require('../../assets/exercises/dominadas_0.webp'),
    require('../../assets/exercises/dominadas_1.webp'),
  ],
  'dominadas asistidas en maquina': [
    require('../../assets/exercises/dominadas-asistidas-en-maquina_0.webp'),
    require('../../assets/exercises/dominadas-asistidas-en-maquina_1.webp'),
  ],
  'dominadas supinas': [
    require('../../assets/exercises/dominadas-supinas_0.webp'),
    require('../../assets/exercises/dominadas-supinas_1.webp'),
  ],
  'encogimientos de hombros con barra': [
    require('../../assets/exercises/encogimientos-de-hombros-con-barra_0.webp'),
    require('../../assets/exercises/encogimientos-de-hombros-con-barra_1.webp'),
  ],
  'encogimientos de hombros con mancuernas': [
    require('../../assets/exercises/encogimientos-de-hombros-con-mancuernas_0.webp'),
    require('../../assets/exercises/encogimientos-de-hombros-con-mancuernas_1.webp'),
  ],
  'face pull': [
    require('../../assets/exercises/face-pull_0.webp'),
    require('../../assets/exercises/face-pull_1.webp'),
  ],
  'hiperextensiones': [
    require('../../assets/exercises/hiperextensiones_0.webp'),
    require('../../assets/exercises/hiperextensiones_1.webp'),
  ],
  'jalon al pecho': [
    require('../../assets/exercises/jalon-al-pecho_0.webp'),
    require('../../assets/exercises/jalon-al-pecho_1.webp'),
  ],
  'jalon al pecho agarre cerrado': [
    require('../../assets/exercises/jalon-al-pecho-agarre-cerrado_0.webp'),
    require('../../assets/exercises/jalon-al-pecho-agarre-cerrado_1.webp'),
  ],
  'jalon tras nuca': [
    require('../../assets/exercises/jalon-tras-nuca_0.webp'),
    require('../../assets/exercises/jalon-tras-nuca_1.webp'),
  ],
  'peso muerto': [
    require('../../assets/exercises/peso-muerto_0.webp'),
    require('../../assets/exercises/peso-muerto_1.webp'),
  ],
  'peso muerto con trap bar': [
    require('../../assets/exercises/peso-muerto-con-trap-bar_0.webp'),
    require('../../assets/exercises/peso-muerto-con-trap-bar_1.webp'),
  ],
  'peso muerto rumano': [
    require('../../assets/exercises/peso-muerto-rumano_0.webp'),
    require('../../assets/exercises/peso-muerto-rumano_1.webp'),
  ],
  'peso muerto sumo': [
    require('../../assets/exercises/peso-muerto-sumo_0.webp'),
    require('../../assets/exercises/peso-muerto-sumo_1.webp'),
  ],
  'pull-over en polea': [
    require('../../assets/exercises/pull-over-en-polea_0.webp'),
    require('../../assets/exercises/pull-over-en-polea_1.webp'),
  ],
  'remo con barra': [
    require('../../assets/exercises/remo-con-barra_0.webp'),
    require('../../assets/exercises/remo-con-barra_1.webp'),
  ],
  'remo con mancuerna a una mano': [
    require('../../assets/exercises/remo-con-mancuerna-a-una-mano_0.webp'),
    require('../../assets/exercises/remo-con-mancuerna-a-una-mano_1.webp'),
  ],
  'remo en maquina': [
    require('../../assets/exercises/remo-en-maquina_0.webp'),
    require('../../assets/exercises/remo-en-maquina_1.webp'),
  ],
  'remo en polea baja (sentado)': [
    require('../../assets/exercises/remo-en-polea-baja-sentado_0.webp'),
    require('../../assets/exercises/remo-en-polea-baja-sentado_1.webp'),
  ],
  'remo en t': [
    require('../../assets/exercises/remo-en-t_0.webp'),
    require('../../assets/exercises/remo-en-t_1.webp'),
  ],
  'remo invertido (australiano)': [
    require('../../assets/exercises/remo-invertido-australiano_0.webp'),
    require('../../assets/exercises/remo-invertido-australiano_1.webp'),
  ],
  'remo renegado': [
    require('../../assets/exercises/remo-renegado_0.webp'),
    require('../../assets/exercises/remo-renegado_1.webp'),
  ],
  'elevacion posterior en maquina': [
    require('../../assets/exercises/elevacion-posterior-en-maquina_0.webp'),
    require('../../assets/exercises/elevacion-posterior-en-maquina_1.webp'),
  ],
  'elevaciones frontales con mancuernas': [
    require('../../assets/exercises/elevaciones-frontales-con-mancuernas_0.webp'),
    require('../../assets/exercises/elevaciones-frontales-con-mancuernas_1.webp'),
  ],
  'elevaciones laterales con mancuernas': [
    require('../../assets/exercises/elevaciones-laterales-con-mancuernas_0.webp'),
    require('../../assets/exercises/elevaciones-laterales-con-mancuernas_1.webp'),
  ],
  'elevaciones laterales en polea': [
    require('../../assets/exercises/elevaciones-laterales-en-polea_0.webp'),
    require('../../assets/exercises/elevaciones-laterales-en-polea_1.webp'),
  ],
  'pajaros (elevacion posterior)': [
    require('../../assets/exercises/pajaros-elevacion-posterior_0.webp'),
    require('../../assets/exercises/pajaros-elevacion-posterior_1.webp'),
  ],
  'press arnold': [
    require('../../assets/exercises/press-arnold_0.webp'),
    require('../../assets/exercises/press-arnold_1.webp'),
  ],
};

/** Las imágenes de un ejercicio, si ya las tiene. */
export const exerciseFrames = (name: string): ExerciseFrames | undefined => FRAMES[exerciseNameKey(name)];
