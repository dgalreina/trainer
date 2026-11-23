import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/** Lo mínimo que usamos de la API de reconocimiento de voz del navegador (no está en los tipos de TypeScript). */
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function recognitionClass(): (new () => Recognition) | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Permite el micrófono para poder dictar.',
  'service-not-allowed': 'Permite el micrófono y el dictado en los ajustes del móvil.',
  'no-speech': 'No te he oído. Prueba otra vez.',
  'audio-capture': 'No encuentro el micrófono.',
  network: 'Sin conexión para el dictado.',
};

/**
 * Dictado por voz (solo web, con el reconocimiento del navegador: gratis y sin backend). `onText` recibe el texto dictado
 * hasta ahora (lo provisional se va corrigiendo) y quien lo use decide cómo unirlo a lo que ya había escrito.
 * En nativo `supported` es false: ahí irá el reconocimiento de Apple al hacer la app de iPhone.
 */
export function useDictation(onText: (text: string) => void) {
  const supported = recognitionClass() !== null;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const callback = useRef(onText);
  callback.current = onText;

  const stop = useCallback(() => rec.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = recognitionClass();
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = 'es-ES';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      callback.current(text.trim());
    };
    r.onerror = (e) => {
      if (e.error !== 'aborted') setError(ERRORS[e.error] ?? 'El dictado ha fallado.');
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
    };
    rec.current = r;
    setError(null);
    try {
      r.start();
      setListening(true);
    } catch {
      rec.current = null;
      setError('No se ha podido empezar el dictado.');
    }
  }, []);

  // Al desmontar, se corta sin más.
  useEffect(() => () => rec.current?.abort(), []);

  return { supported, listening, error, start, stop };
}
