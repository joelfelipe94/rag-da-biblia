import type { ReactNode } from 'react';
import type { TrechoDTO } from '../tipos';
import { renderizarMarkdown, type RenderizarTexto } from './renderizarMarkdown';

type Props = {
  texto: string;
  trechos: TrechoDTO[];
  aoAbrirTrecho: (trecho: TrechoDTO) => void;
};

function escaparRegex(valor: string): string {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Trecho "capítulo[:versículo]" reutilizado tanto na referência principal quanto
// nas continuações (com "Capítulo"/"cap." e "Versículo(s)"/"v." opcionais).
const NUMERO_CAP_VERSICULO =
  `(?:cap[íi]tulos?|cap\\.?)?[\\s:]*(\\d{1,3})` +
  `((?:\\s*[,:]?\\s*(?:vers[íi]culos?|v{1,2}s?\\.?)?[\\s:]*\\d+` +
  `(?:\\s*[-–]\\s*\\d+)?(?:\\s*,\\s*\\d+)*)?)`;

// Item seguinte de uma referência composta, que omite o nome do livro e o herda
// da referência anterior: "..., 9:6; 12:31" ou "... 9:6 e Capítulo 15:4".
// Não é global: usada com `.exec` sobre o texto restante, ancorada no início.
const REGEX_CONTINUACAO = new RegExp(
  `^(\\s*;\\s*(?:e\\s+)?|\\s+e\\s+)${NUMERO_CAP_VERSICULO}`,
  'i',
);

/**
 * Cria a função que transforma menções a `livro + capítulo` correspondentes a um
 * trecho recuperado em links que abrem o modal daquele trecho. Quando não há
 * trechos, o texto puro é devolvido sem alteração.
 */
function criarLinkadorDeReferencias(
  trechos: TrechoDTO[],
  aoAbrirTrecho: (trecho: TrechoDTO) => void,
): RenderizarTexto {
  if (trechos.length === 0) {
    return (texto) => texto;
  }

  const porLivro = new Map<string, TrechoDTO[]>();
  for (const trecho of trechos) {
    const chave = trecho.livro.toLowerCase();
    const lista = porLivro.get(chave) ?? [];
    lista.push(trecho);
    porLivro.set(chave, lista);
  }

  const nomes = [...new Set(trechos.map((trecho) => trecho.livro))].sort(
    (a, b) => b.length - a.length,
  );
  const alternativa = nomes.map(escaparRegex).join('|');
  // Aceita as várias formas que o LLM usa para citar: "João 3", "João 3:16",
  // "Mateus, 9:6", "Marcos 11:25-26" e a forma por extenso "Mateus, Capítulo
  // 18, Versículo 35". Referências compostas — "(Mateus, Capítulo 9:6; Lucas,
  // Capítulo 5:24)" — saem como vários resultados do `matchAll`; quando o item
  // seguinte omite o livro ("... 9:6; 12:31"), ele é tratado pelo laço de
  // continuação abaixo.
  const regex = new RegExp(`(${alternativa})[\\s,]+${NUMERO_CAP_VERSICULO}`, 'gi');

  return (texto, chaveBase) => {
    const partes: ReactNode[] = [];
    let ultimo = 0;
    let indice = 0;

    const empurrarReferencia = (
      textoRef: string,
      nomeLivro: string,
      numeroCapitulo: number,
    ): void => {
      const alvo = (porLivro.get(nomeLivro.toLowerCase()) ?? []).find(
        (trecho) => trecho.numeroCapitulo === numeroCapitulo,
      );
      if (alvo) {
        partes.push(
          <button
            key={`ref-${chaveBase}-${indice++}`}
            type="button"
            className="ref-link"
            onClick={() => aoAbrirTrecho(alvo)}
          >
            {textoRef}
          </button>,
        );
      } else {
        partes.push(textoRef);
      }
    };

    for (const encontrado of texto.matchAll(regex)) {
      const inicio = encontrado.index ?? 0;
      // Um item pode já ter sido consumido pelo laço de continuação anterior.
      if (inicio < ultimo) continue;

      const livro = encontrado[1] ?? '';
      let fim = inicio + encontrado[0].length;

      if (inicio > ultimo) partes.push(texto.slice(ultimo, inicio));
      empurrarReferencia(encontrado[0], livro, Number(encontrado[2]));
      ultimo = fim;

      // Continuações que herdam o livro: "... 9:6; 12:31; Capítulo 15:4".
      let continuacao = REGEX_CONTINUACAO.exec(texto.slice(fim));
      while (continuacao !== null) {
        const separador = continuacao[1] ?? '';
        const textoRef = continuacao[0].slice(separador.length);
        partes.push(separador);
        empurrarReferencia(textoRef, livro, Number(continuacao[2]));
        fim += continuacao[0].length;
        ultimo = fim;
        continuacao = REGEX_CONTINUACAO.exec(texto.slice(fim));
      }
    }

    if (ultimo < texto.length) partes.push(texto.slice(ultimo));

    return <>{partes}</>;
  };
}

/**
 * Renderiza o texto da resposta aplicando a marcação Markdown (`**negrito**` e
 * bullets `*`) e transformando em links as menções a `livro + capítulo` que
 * correspondem a um trecho recuperado.
 */
export function TextoComReferencias({ texto, trechos, aoAbrirTrecho }: Props) {
  if (!texto) return null;

  const linkar = criarLinkadorDeReferencias(trechos, aoAbrirTrecho);
  return <>{renderizarMarkdown(texto, linkar)}</>;
}
