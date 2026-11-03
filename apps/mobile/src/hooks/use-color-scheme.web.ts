import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

// Para el renderizado estático, el primer render en el cliente debe devolver 'light'
// (el HTML exportado no sabe el tema del dispositivo). Pero eso solo vale para la
// hidratación inicial: se recuerda a nivel de módulo, y los componentes que se montan
// después (por ejemplo, filas nuevas de una lista) ya usan el tema real. Si cada
// componente lo decidiera por su cuenta, todos parpadearían en claro al montarse.
let hydrated = false;

export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(hydrated);

  useEffect(() => {
    hydrated = true;
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
