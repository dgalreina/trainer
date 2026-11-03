// Aviso sonoro de fin de descanso (solo web; en nativo no hace nada por ahora).
// Los navegadores solo dejan sonar audio si se "desbloquea" dentro de un gesto del usuario,
// así que `unlockAudio` se llama al pulsar (por ejemplo, al marcar una serie) y `beep`
// suena después, cuando acaba el descanso.

type AudioContextLike = {
  currentTime: number;
  destination: unknown;
  resume?: () => void;
  createOscillator: () => {
    frequency: { value: number };
    connect: (node: unknown) => unknown;
    start: () => void;
    stop: (when: number) => void;
  };
  createGain: () => {
    gain: {
      setValueAtTime: (value: number, when: number) => void;
      exponentialRampToValueAtTime: (value: number, when: number) => void;
    };
    connect: (node: unknown) => unknown;
  };
};

let context: AudioContextLike | null = null;

export function unlockAudio(): void {
  try {
    const g = globalThis as unknown as {
      AudioContext?: new () => AudioContextLike;
      webkitAudioContext?: new () => AudioContextLike;
    };
    const Ctor = g.AudioContext ?? g.webkitAudioContext;
    if (!Ctor) return;
    context ??= new Ctor();
    context.resume?.();
  } catch {
    // Sin audio, el aviso sigue siendo visual y por vibración.
  }
}

export function beep(): void {
  try {
    if (!context) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.18, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + 0.6);
  } catch {
    // ver unlockAudio
  }
}
