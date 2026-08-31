import type { ReactNode } from 'react';

/**
 * Renderiza um trecho de texto puro (sem marcação Markdown). É o ponto de
 * extensão usado por `TextoComReferencias` para transformar menções a
 * `livro + capítulo` em links.
 */
export type RenderizarTexto = (texto: string, chave: string) => ReactNode;

/**
 * Converte um subconjunto de Markdown em elementos React, para que a resposta
 * apareça na interface "como ficaria" em um arquivo Markdown renderizado:
 *
 * - `**trecho**` vira `<strong>` (negrito);
 * - uma linha iniciada por um único `*` (seguido de espaço) vira um bullet `•`,
 *   preservando a indentação. `**` no início da linha continua sendo negrito e
 *   não é confundido com bullet.
 *
 * O texto puro entre as marcações passa por `renderizarTexto`, que continua
 * responsável por transformar as referências bíblicas em links.
 */
export function renderizarMarkdown(
  texto: string,
  renderizarTexto: RenderizarTexto,
): ReactNode {
  const linhas = texto.split('\n');

  return (
    <>
      {linhas.map((linha, i) => {
        const bullet = linha.match(/^(\s*)\*[ \t]+(?!\*)(.*)$/);
        const conteudo = bullet
          ? `${bullet[1] ?? ''}• ${bullet[2] ?? ''}`
          : linha;

        return (
          <span key={`linha-${i}`}>
            {renderizarInline(conteudo, renderizarTexto, `linha-${i}`)}
            {i < linhas.length - 1 ? '\n' : null}
          </span>
        );
      })}
    </>
  );
}

function renderizarInline(
  texto: string,
  renderizarTexto: RenderizarTexto,
  chaveBase: string,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let ultimo = 0;
  let indice = 0;

  for (const encontrado of texto.matchAll(/\*\*([^\n*]+?)\*\*/g)) {
    const inicio = encontrado.index ?? 0;

    if (inicio > ultimo) {
      const chave = `${chaveBase}-t${indice}`;
      nodes.push(
        <span key={chave}>{renderizarTexto(texto.slice(ultimo, inicio), chave)}</span>,
      );
    }

    const chaveNegrito = `${chaveBase}-b${indice}`;
    nodes.push(
      <strong key={chaveNegrito}>
        {renderizarTexto(encontrado[1] ?? '', `${chaveNegrito}-t`)}
      </strong>,
    );

    ultimo = inicio + encontrado[0].length;
    indice += 1;
  }

  if (ultimo < texto.length || nodes.length === 0) {
    const chave = `${chaveBase}-t${indice}`;
    nodes.push(
      <span key={chave}>{renderizarTexto(texto.slice(ultimo), chave)}</span>,
    );
  }

  return nodes;
}
