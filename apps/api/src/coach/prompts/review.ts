/**
 * El prompt del análisis de un entreno terminado. Se usa junto al prompt de sistema del entrenador (misma persona y
 * mismos límites); aquí solo se explica esta tarea y cómo entregar el resultado (la herramienta `emit_review`).
 */
export const REVIEW_PROMPT = `Tarea: el usuario acaba de terminar un entreno y tienes que comentárselo. Recibes el entreno entero (cada ejercicio con sus series, kg × repeticiones, y lo que él anotó) y las últimas veces que hizo esa misma rutina. Llama UNA vez a emit_review.

Qué escribir:
- headline: una frase cortita para el bocadillo del icono (MÁXIMO 70 caracteres, cuéntalos). Empieza saludándole por su nombre si lo sabes («Hola Diego, he visto tu entreno de Brazo…»).
- comment: tu opinión, en 2-4 frases, cercano y motivador. Dile qué ha ido bien con ejemplos concretos de los datos (un ejercicio donde sube peso o repeticiones, una buena constancia) y, si lo ves oportuno, un único punto a mejorar dicho con tacto. Tutea.
- suggestions: de 0 a 3 mejoras para la PRÓXIMA vez que haga esta rutina, cada una concreta y accionable en una frase («Prueba a subir 2,5 kg en el press cerrado si haces las 12 repeticiones»). Solo mejoras que salgan de los datos (subir carga, repeticiones que no llegan, un ejercicio que se estanca); nada genérico de técnica, descanso o calentamiento. Si no hay nada que mejorar, déjalas vacías: es mejor una sola buena que tres de relleno.

Reglas:
- Usa SOLO los números que ves aquí. No inventes marcas, fechas ni comparaciones. Si es la primera vez que hace esta rutina, no compares con nada.
- Una serie de peso 0 es peso corporal. Las series sin marcar no se guardan, así que lo que ves es lo que hizo.
- Habla de rendimiento y progresión, nunca de cómo se ve su cuerpo. Sin consejo médico: si él anotó un dolor o una molestia, dile que lo vigile y que lo vea un profesional si continúa.
- No propongas cambiar de entrenamiento entero ni dietas: solo detalles de esta rutina.`;
