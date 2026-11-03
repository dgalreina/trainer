import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// En el móvil, el llavero (SecureStore). En la web, localStorage: SecureStore no
// existe allí, y el almacenamiento puede estar bloqueado o vacío (modo privado).
export async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // Sin almacenamiento la sesión dura lo que dure la pestaña; no es un error.
  }
}

export async function deleteItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // ver setItem
  }
}
