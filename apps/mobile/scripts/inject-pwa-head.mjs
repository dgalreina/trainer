// Inserta en cada HTML exportado las etiquetas que hacen la web instalable como PWA.
// Safari, sin ellas, la abre con sus barras aunque se añada a la pantalla de inicio.
//
// No se hace con un +html.tsx ni con <Head> en el layout: en esta versión de Expo un
// +html personalizado deja el HTML sin scripts ni estilos, y <Head> solo escribe
// etiquetas dentro de una pantalla, no en el layout raíz.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const app = JSON.parse(readFileSync("app.json", "utf8"));
const base = app.expo.experiments?.baseUrl ?? "";

const tags = [
  `<title>Trainer</title>`,
  `<link rel="manifest" href="${base}/manifest.webmanifest"/>`,
  `<link rel="apple-touch-icon" href="${base}/icon.png"/>`,
  `<meta name="apple-mobile-web-app-capable" content="yes"/>`,
  `<meta name="mobile-web-app-capable" content="yes"/>`,
  `<meta name="apple-mobile-web-app-title" content="Trainer"/>`,
  // "default": iOS adapta el texto de la barra de estado al modo claro u oscuro.
  `<meta name="apple-mobile-web-app-status-bar-style" content="default"/>`,
  `<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)"/>`,
  `<meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)"/>`,
].join("");

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* htmlFiles(path);
    else if (name.endsWith(".html")) yield path;
  }
}

let count = 0;
for (const file of htmlFiles("dist")) {
  const html = readFileSync(file, "utf8");
  if (html.includes('rel="manifest"')) continue;
  if (!html.includes("</head>")) throw new Error(`${file} no tiene </head>`);
  writeFileSync(file, html.replace("</head>", `${tags}</head>`));
  count++;
}
console.log(`PWA: etiquetas añadidas a ${count} HTML`);
