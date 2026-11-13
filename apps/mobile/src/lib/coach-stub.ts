/**
 * Respuestas DE PRUEBA del entrenador: no hay IA todavía. Sirven para probar el icono, el chat y cómo se
 * siente el texto saliendo poco a poco. Cuando llegue la IA real, `streamCoachReply` se sustituye por una
 * llamada al backend (Lambda con streaming) y el resto del chat no cambia.
 */

const SUGGESTIONS: { match: RegExp; reply: string }[] = [
  {
    match: /mejor|mejora/i,
    reply:
      'Te lo diré con tus números cuando tenga acceso a tus entrenos. Por ahora, lo que casi siempre da más resultado: ' +
      'subir poco a poco el peso o las repeticiones cada semana y dormir bien. ¡Vas por buen camino!',
  },
  {
    match: /entren|rutina/i,
    reply:
      'Cuando esté conectado, te prepararé un entrenamiento con ejercicios de tu catálogo y te lo enseñaré para que ' +
      'decidas si lo guardas. Dime cuántos días a la semana puedes entrenar y qué quieres trabajar más.',
  },
  {
    match: /com|dieta|aliment/i,
    reply:
      'Más adelante miraré lo que registras y te diré cómo vas de proteína y de calorías. Recuerda que las cifras las ' +
      'calcula la app y yo te ayudo a entenderlas y a adaptarlas. ¡Cada comida registrada suma!',
  },
  {
    match: /crec|musc|masa/i,
    reply:
      'Para crecer más: superávit pequeño y constante, proteína repartida en el día, progresión en tus ejercicios ' +
      'principales y descanso. Con tus datos reales podré concretarlo mucho más.',
  },
];

const FALLBACK =
  'Ahora mismo respondo en modo de prueba, así que todavía no puedo mirar tus datos. En cuanto esté listo, ' +
  'podrás preguntarme lo que quieras sobre tus entrenos, tu dieta y tu progreso. ¡Ánimo!';

/** El texto de la respuesta de prueba para un mensaje. */
export function stubReplyFor(message: string): string {
  return SUGGESTIONS.find((s) => s.match.test(message))?.reply ?? FALLBACK;
}

/**
 * La respuesta, a trozos (palabras) con una pequeña pausa entre ellos, como saldría con streaming. Se detiene si
 * `signal` se cancela (el usuario cierra el chat o pide parar): con la IA real eso también cancela la llamada.
 */
export async function* streamCoachReply(message: string, signal?: AbortSignal): AsyncGenerator<string> {
  const words = stubReplyFor(message).split(' ');
  // Una pausa inicial, como cuando «piensa».
  await pause(450, signal);
  for (const word of words) {
    if (signal?.aborted) return;
    yield (word === words[0] ? '' : ' ') + word;
    await pause(35 + Math.random() * 40, signal);
  }
}

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
