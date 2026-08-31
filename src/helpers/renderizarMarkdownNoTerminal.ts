const ANSI_NEGRITO = '\x1b[1m';
const ANSI_FIM_NEGRITO = '\x1b[22m';

/**
 * Converte um subconjunto de Markdown para os códigos de escape ANSI
 * equivalentes, de modo que o texto apareça no terminal "como ficaria" em um
 * arquivo Markdown renderizado:
 *
 * - `**trecho**` vira negrito (ANSI bold);
 * - uma linha iniciada por um único `*` (seguido de espaço) vira um bullet `•`,
 *   preservando a indentação. `**` no início de linha continua sendo negrito e
 *   não é confundido com bullet.
 *
 * @param texto Texto em Markdown.
 * @return Texto com escapes ANSI no lugar da marcação.
 */
export function renderizarMarkdownNoTerminal(texto: string): string {
  const comBullets = texto
    .split('\n')
    .map((linha) => linha.replace(/^(\s*)\*[ \t]+(?!\*)/, '$1• '))
    .join('\n');

  return comBullets.replace(
    /\*\*([^\n*]+?)\*\*/g,
    `${ANSI_NEGRITO}$1${ANSI_FIM_NEGRITO}`,
  );
}
