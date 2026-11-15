/**
 * Un Markdown pequeño para el chat del entrenador: Claude escribe con **negritas**, *cursiva*, listas y títulos, y la app
 * lo pinta con formato en vez de enseñar los asteriscos. Solo entiende lo que Claude usa en un chat; lo demás sale como texto.
 */

export type Inline = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

export type Block =
  | { type: 'paragraph'; inline: Inline[] }
  | { type: 'heading'; inline: Inline[] }
  | { type: 'bullet'; inline: Inline[] }
  | { type: 'number'; n: string; inline: Inline[] };

// **negrita** | *cursiva* (sin espacios pegados al asterisco: «6 * 8» no cuenta) | `código`
const INLINE = /\*\*(.+?)\*\*|\*(?!\s)([^*]+?)(?<!\s)\*|`([^`]+)`/g;

/** Texto con marcas → trozos con su estilo. Una marca sin cerrar se deja tal cual. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at) });
    if (m[1] !== undefined) out.push({ text: m[1], bold: true });
    else if (m[2] !== undefined) out.push({ text: m[2], italic: true });
    else out.push({ text: m[3], code: true });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length > 0 ? out : [{ text }];
}

/** Texto completo → bloques (párrafos, títulos, viñetas y listas numeradas). Las líneas en blanco separan párrafos. */
export function parseBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ type: 'paragraph', inline: parseInline(paragraph.join('\n')) });
    paragraph = [];
  };
  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    let m: RegExpMatchArray | null;
    if (line.trim() === '') flush();
    else if ((m = line.match(/^\s*#{1,6}\s+(.*)$/))) {
      flush();
      blocks.push({ type: 'heading', inline: parseInline(m[1]) });
    } else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
      flush();
      blocks.push({ type: 'bullet', inline: parseInline(m[1]) });
    } else if ((m = line.match(/^\s*(\d{1,2})[.)]\s+(.*)$/))) {
      flush();
      blocks.push({ type: 'number', n: m[1], inline: parseInline(m[2]) });
    } else paragraph.push(line.trim());
  }
  flush();
  return blocks;
}
