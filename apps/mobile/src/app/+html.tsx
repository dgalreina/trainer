import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Ruta base cuando se publica en una subruta (GitHub Pages); vacía en local.
const base = process.env.EXPO_BASE_URL ?? '';

// HTML raíz de la versión web. Declara la PWA: sin esto Safari la trata como una
// página más y la abre con sus barras, aunque se añada a la pantalla de inicio.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Trainer</title>

        <link rel="manifest" href={`${base}/manifest.webmanifest`} />
        <link rel="apple-touch-icon" href={`${base}/icon.png`} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Trainer" />
        {/* "default": iOS adapta el texto de la barra de estado al modo claro u oscuro. */}
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
