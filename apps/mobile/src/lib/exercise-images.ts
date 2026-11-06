import { exerciseNameKey } from '@trainer/shared';
import type { ImageSourcePropType } from 'react-native';

/** Las posiciones de un ejercicio, de la de inicio a la final (normalmente dos; el curl 21s lleva tres). */
export type ExerciseFrames = [ImageSourcePropType, ImageSourcePropType, ...ImageSourcePropType[]];

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
  'press militar con barra': [
    require('../../assets/exercises/press-militar-con-barra_0.webp'),
    require('../../assets/exercises/press-militar-con-barra_1.webp'),
  ],
  'press militar con mancuernas': [
    require('../../assets/exercises/press-militar-con-mancuernas_0.webp'),
    require('../../assets/exercises/press-militar-con-mancuernas_1.webp'),
  ],
  'press militar en maquina': [
    require('../../assets/exercises/press-militar-en-maquina_0.webp'),
    require('../../assets/exercises/press-militar-en-maquina_1.webp'),
  ],
  'press tras nuca': [
    require('../../assets/exercises/press-tras-nuca_0.webp'),
    require('../../assets/exercises/press-tras-nuca_1.webp'),
  ],
  'remo al menton': [
    require('../../assets/exercises/remo-al-menton_0.webp'),
    require('../../assets/exercises/remo-al-menton_1.webp'),
  ],
  'curl concentrado': [
    require('../../assets/exercises/curl-concentrado_0.webp'),
    require('../../assets/exercises/curl-concentrado_1.webp'),
  ],
  'curl de biceps con barra': [
    require('../../assets/exercises/curl-de-biceps-con-barra_0.webp'),
    require('../../assets/exercises/curl-de-biceps-con-barra_1.webp'),
  ],
  'curl de biceps con mancuernas': [
    require('../../assets/exercises/curl-de-biceps-con-mancuernas_0.webp'),
    require('../../assets/exercises/curl-de-biceps-con-mancuernas_1.webp'),
  ],
  'curl en banco scott (predicador)': [
    require('../../assets/exercises/curl-en-banco-scott-predicador_0.webp'),
    require('../../assets/exercises/curl-en-banco-scott-predicador_1.webp'),
  ],
  'curl en maquina': [
    require('../../assets/exercises/curl-en-maquina_0.webp'),
    require('../../assets/exercises/curl-en-maquina_1.webp'),
  ],
  'curl en polea': [
    require('../../assets/exercises/curl-en-polea_0.webp'),
    require('../../assets/exercises/curl-en-polea_1.webp'),
  ],
  'curl inverso con barra': [
    require('../../assets/exercises/curl-inverso-con-barra_0.webp'),
    require('../../assets/exercises/curl-inverso-con-barra_1.webp'),
  ],
  'curl martillo': [
    require('../../assets/exercises/curl-martillo_0.webp'),
    require('../../assets/exercises/curl-martillo_1.webp'),
  ],
  'extension de triceps en maquina': [
    require('../../assets/exercises/extension-de-triceps-en-maquina_0.webp'),
    require('../../assets/exercises/extension-de-triceps-en-maquina_1.webp'),
  ],
  'extension de triceps en polea (barra)': [
    require('../../assets/exercises/extension-de-triceps-en-polea-barra_0.webp'),
    require('../../assets/exercises/extension-de-triceps-en-polea-barra_1.webp'),
  ],
  'extension de triceps en polea (cuerda)': [
    require('../../assets/exercises/extension-de-triceps-en-polea-cuerda_0.webp'),
    require('../../assets/exercises/extension-de-triceps-en-polea-cuerda_1.webp'),
  ],
  'extension de triceps sobre la cabeza con mancuerna': [
    require('../../assets/exercises/extension-de-triceps-sobre-la-cabeza-con-mancuerna_0.webp'),
    require('../../assets/exercises/extension-de-triceps-sobre-la-cabeza-con-mancuerna_1.webp'),
  ],
  'fondos en banco': [
    require('../../assets/exercises/fondos-en-banco_0.webp'),
    require('../../assets/exercises/fondos-en-banco_1.webp'),
  ],
  'patada de triceps con mancuerna': [
    require('../../assets/exercises/patada-de-triceps-con-mancuerna_0.webp'),
    require('../../assets/exercises/patada-de-triceps-con-mancuerna_1.webp'),
  ],
  'fondos en paralelas (triceps)': [
    require('../../assets/exercises/fondos-en-paralelas-triceps_0.webp'),
    require('../../assets/exercises/fondos-en-paralelas-triceps_1.webp'),
  ],
  'press frances con barra': [
    require('../../assets/exercises/press-frances-con-barra_0.webp'),
    require('../../assets/exercises/press-frances-con-barra_1.webp'),
  ],
  'press frances con mancuerna': [
    require('../../assets/exercises/press-frances-con-mancuerna_0.webp'),
    require('../../assets/exercises/press-frances-con-mancuerna_1.webp'),
  ],
  'abduccion de cadera en maquina': [
    require('../../assets/exercises/abduccion-de-cadera-en-maquina_0.webp'),
    require('../../assets/exercises/abduccion-de-cadera-en-maquina_1.webp'),
  ],
  'aduccion de cadera en maquina': [
    require('../../assets/exercises/aduccion-de-cadera-en-maquina_0.webp'),
    require('../../assets/exercises/aduccion-de-cadera-en-maquina_1.webp'),
  ],
  'curl femoral de pie': [
    require('../../assets/exercises/curl-femoral-de-pie_0.webp'),
    require('../../assets/exercises/curl-femoral-de-pie_1.webp'),
  ],
  'curl femoral nordico': [
    require('../../assets/exercises/curl-femoral-nordico_0.webp'),
    require('../../assets/exercises/curl-femoral-nordico_1.webp'),
  ],
  'curl femoral sentado': [
    require('../../assets/exercises/curl-femoral-sentado_0.webp'),
    require('../../assets/exercises/curl-femoral-sentado_1.webp'),
  ],
  'curl femoral tumbado': [
    require('../../assets/exercises/curl-femoral-tumbado_0.webp'),
    require('../../assets/exercises/curl-femoral-tumbado_1.webp'),
  ],
  'elevacion de gemelos de pie': [
    require('../../assets/exercises/elevacion-de-gemelos-de-pie_0.webp'),
    require('../../assets/exercises/elevacion-de-gemelos-de-pie_1.webp'),
  ],
  'elevacion de gemelos en prensa': [
    require('../../assets/exercises/elevacion-de-gemelos-en-prensa_0.webp'),
    require('../../assets/exercises/elevacion-de-gemelos-en-prensa_1.webp'),
  ],
  'elevacion de gemelos sentado': [
    require('../../assets/exercises/elevacion-de-gemelos-sentado_0.webp'),
    require('../../assets/exercises/elevacion-de-gemelos-sentado_1.webp'),
  ],
  'extension de cuadriceps': [
    require('../../assets/exercises/extension-de-cuadriceps_0.webp'),
    require('../../assets/exercises/extension-de-cuadriceps_1.webp'),
  ],
  'hip thrust con barra': [
    require('../../assets/exercises/hip-thrust-con-barra_0.webp'),
    require('../../assets/exercises/hip-thrust-con-barra_1.webp'),
  ],
  'patada de gluteo en polea': [
    require('../../assets/exercises/patada-de-gluteo-en-polea_0.webp'),
    require('../../assets/exercises/patada-de-gluteo-en-polea_1.webp'),
  ],
  'peso muerto a una pierna': [
    require('../../assets/exercises/peso-muerto-a-una-pierna_0.webp'),
    require('../../assets/exercises/peso-muerto-a-una-pierna_1.webp'),
  ],
  'prensa de piernas': [
    require('../../assets/exercises/prensa-de-piernas_0.webp'),
    require('../../assets/exercises/prensa-de-piernas_1.webp'),
  ],
  'puente de gluteo': [
    require('../../assets/exercises/puente-de-gluteo_0.webp'),
    require('../../assets/exercises/puente-de-gluteo_1.webp'),
  ],
  'puente de gluteo a una pierna': [
    require('../../assets/exercises/puente-de-gluteo-a-una-pierna_0.webp'),
    require('../../assets/exercises/puente-de-gluteo-a-una-pierna_1.webp'),
  ],
  'sentadilla con barra': [
    require('../../assets/exercises/sentadilla-con-barra_0.webp'),
    require('../../assets/exercises/sentadilla-con-barra_1.webp'),
  ],
  'sentadilla en maquina smith': [
    require('../../assets/exercises/sentadilla-en-maquina-smith_0.webp'),
    require('../../assets/exercises/sentadilla-en-maquina-smith_1.webp'),
  ],
  'sentadilla bulgara': [
    require('../../assets/exercises/sentadilla-bulgara_0.webp'),
    require('../../assets/exercises/sentadilla-bulgara_1.webp'),
  ],
  'sentadilla frontal': [
    require('../../assets/exercises/sentadilla-frontal_0.webp'),
    require('../../assets/exercises/sentadilla-frontal_1.webp'),
  ],
  'sentadilla goblet': [
    require('../../assets/exercises/sentadilla-goblet_0.webp'),
    require('../../assets/exercises/sentadilla-goblet_1.webp'),
  ],
  'sentadilla hack': [
    require('../../assets/exercises/sentadilla-hack_0.webp'),
    require('../../assets/exercises/sentadilla-hack_1.webp'),
  ],
  'sissy squat': [
    require('../../assets/exercises/sissy-squat_0.webp'),
    require('../../assets/exercises/sissy-squat_1.webp'),
  ],
  'step-up con mancuernas': [
    require('../../assets/exercises/step-up-con-mancuernas_0.webp'),
    require('../../assets/exercises/step-up-con-mancuernas_1.webp'),
  ],
  'zancada inversa': [
    require('../../assets/exercises/zancada-inversa_0.webp'),
    require('../../assets/exercises/zancada-inversa_1.webp'),
  ],
  'zancada lateral': [
    require('../../assets/exercises/zancada-lateral_0.webp'),
    require('../../assets/exercises/zancada-lateral_1.webp'),
  ],
  'zancadas caminando': [
    require('../../assets/exercises/zancadas-caminando_0.webp'),
    require('../../assets/exercises/zancadas-caminando_1.webp'),
  ],
  'zancadas con mancuernas': [
    require('../../assets/exercises/zancadas-con-mancuernas_0.webp'),
    require('../../assets/exercises/zancadas-con-mancuernas_1.webp'),
  ],
  'crunch abdominal': [
    require('../../assets/exercises/crunch-abdominal_0.webp'),
    require('../../assets/exercises/crunch-abdominal_1.webp'),
  ],
  'crunch en polea': [
    require('../../assets/exercises/crunch-en-polea_0.webp'),
    require('../../assets/exercises/crunch-en-polea_1.webp'),
  ],
  'elevacion de piernas colgado': [
    require('../../assets/exercises/elevacion-de-piernas-colgado_0.webp'),
    require('../../assets/exercises/elevacion-de-piernas-colgado_1.webp'),
  ],
  'elevacion de piernas tumbado': [
    require('../../assets/exercises/elevacion-de-piernas-tumbado_0.webp'),
    require('../../assets/exercises/elevacion-de-piernas-tumbado_1.webp'),
  ],
  'elevacion de rodillas colgado': [
    require('../../assets/exercises/elevacion-de-rodillas-colgado_0.webp'),
    require('../../assets/exercises/elevacion-de-rodillas-colgado_1.webp'),
  ],
  'encogimiento abdominal en maquina': [
    require('../../assets/exercises/encogimiento-abdominal-en-maquina_0.webp'),
    require('../../assets/exercises/encogimiento-abdominal-en-maquina_1.webp'),
  ],
  'escaladores (mountain climbers)': [
    require('../../assets/exercises/escaladores-mountain-climbers_0.webp'),
    require('../../assets/exercises/escaladores-mountain-climbers_1.webp'),
  ],
  'giro ruso (russian twist)': [
    require('../../assets/exercises/giro-ruso-russian-twist_0.webp'),
    require('../../assets/exercises/giro-ruso-russian-twist_1.webp'),
  ],
  'rueda abdominal (ab wheel)': [
    require('../../assets/exercises/rueda-abdominal-ab-wheel_0.webp'),
    require('../../assets/exercises/rueda-abdominal-ab-wheel_1.webp'),
  ],
  'curl de muneca con barra': [
    require('../../assets/exercises/curl-de-muneca-con-barra_0.webp'),
    require('../../assets/exercises/curl-de-muneca-con-barra_1.webp'),
  ],
  'curl de muneca inverso': [
    require('../../assets/exercises/curl-de-muneca-inverso_0.webp'),
    require('../../assets/exercises/curl-de-muneca-inverso_1.webp'),
  ],
  'arrastre de trineo (sled pull)': [
    require('../../assets/exercises/arrastre-de-trineo-sled-pull_0.webp'),
    require('../../assets/exercises/arrastre-de-trineo-sled-pull_1.webp'),
  ],
  'bicicleta estatica': [
    require('../../assets/exercises/bicicleta-estatica_0.webp'),
    require('../../assets/exercises/bicicleta-estatica_1.webp'),
  ],
  'cinta de correr': [
    require('../../assets/exercises/cinta-de-correr_0.webp'),
    require('../../assets/exercises/cinta-de-correr_1.webp'),
  ],
  'comba (salto de cuerda)': [
    require('../../assets/exercises/comba-salto-de-cuerda_0.webp'),
    require('../../assets/exercises/comba-salto-de-cuerda_1.webp'),
  ],
  'empuje de trineo (sled push)': [
    require('../../assets/exercises/empuje-de-trineo-sled-push_0.webp'),
    require('../../assets/exercises/empuje-de-trineo-sled-push_1.webp'),
  ],
  'kettlebell swing': [
    require('../../assets/exercises/kettlebell-swing_0.webp'),
    require('../../assets/exercises/kettlebell-swing_1.webp'),
  ],
  'remo en maquina (rowing)': [
    require('../../assets/exercises/remo-en-maquina-rowing_0.webp'),
    require('../../assets/exercises/remo-en-maquina-rowing_1.webp'),
  ],
  'saltos al cajon (box jumps)': [
    require('../../assets/exercises/saltos-al-cajon-box-jumps_0.webp'),
    require('../../assets/exercises/saltos-al-cajon-box-jumps_1.webp'),
  ],
  'paseo del granjero (farmer walk)': [
    require('../../assets/exercises/paseo-del-granjero-farmer-walk_0.webp'),
    require('../../assets/exercises/paseo-del-granjero-farmer-walk_1.webp'),
  ],
  'clean (cargada)': [
    require('../../assets/exercises/clean-cargada_0.webp'),
    require('../../assets/exercises/clean-cargada_1.webp'),
  ],
  'clean and jerk': [
    require('../../assets/exercises/clean-and-jerk_0.webp'),
    require('../../assets/exercises/clean-and-jerk_1.webp'),
  ],
  'push press': [
    require('../../assets/exercises/push-press_0.webp'),
    require('../../assets/exercises/push-press_1.webp'),
  ],
  'snatch (arrancada)': [
    require('../../assets/exercises/snatch-arrancada_0.webp'),
    require('../../assets/exercises/snatch-arrancada_1.webp'),
  ],
  'thruster': [
    require('../../assets/exercises/thruster_0.webp'),
    require('../../assets/exercises/thruster_1.webp'),
  ],
  'turkish get-up': [
    require('../../assets/exercises/turkish-get-up_0.webp'),
    require('../../assets/exercises/turkish-get-up_1.webp'),
  ],
  // Tres posiciones: abajo, mitad (la pausa de las 21) y arriba.
  'curl 21s': [
    require('../../assets/exercises/curl-21s_0.webp'),
    require('../../assets/exercises/curl-21s_mid.webp'),
    require('../../assets/exercises/curl-21s_1.webp'),
  ],
  'remo pendlay': [
    require('../../assets/exercises/remo-pendlay_0.webp'),
    require('../../assets/exercises/remo-pendlay_1.webp'),
  ],
  'battle ropes': [
    require('../../assets/exercises/battle-ropes_0.webp'),
    require('../../assets/exercises/battle-ropes_1.webp'),
  ],
  'wall balls': [
    require('../../assets/exercises/wall-balls_0.webp'),
    require('../../assets/exercises/wall-balls_1.webp'),
  ],
  'elevaciones frontales con barra': [
    require('../../assets/exercises/elevaciones-frontales-con-barra_0.webp'),
    require('../../assets/exercises/elevaciones-frontales-con-barra_1.webp'),
  ],
  'elevaciones laterales en banco inclinado': [
    require('../../assets/exercises/elevaciones-laterales-en-banco-inclinado_0.webp'),
    require('../../assets/exercises/elevaciones-laterales-en-banco-inclinado_1.webp'),
  ],
};

/** Las imágenes de un ejercicio, si ya las tiene. */
export const exerciseFrames = (name: string): ExerciseFrames | undefined => FRAMES[exerciseNameKey(name)];
