import type { ResultadoFinal, ResultadoFts, ResultadoVetorial } from "../../types.js";
import { montarChaveResultado } from "../montarChaveResultado.js";

/**
 * Funde os resultados da busca lexical (FTS) e da busca vetorial em uma única
 * lista ordenada usando Reciprocal Rank Fusion (RRF) ponderado.
 *
 * Para cada lista, a contribuição de um resultado é
 * `peso * (1 / (k + posicao))`, onde `k = 60` (constante de amortecimento do RRF)
 * e `posicao` é a colocação 1-indexada do resultado na lista de origem. Portanto,
 * as listas de entrada devem já estar ordenadas por relevância decrescente, pois
 * é o índice no array — e não o `scoreFts` / `scoreVetorial` — que define a
 * colocação.
 *
 * Os resultados são deduplicados pela chave
 * `testamento|livro|numeroCapitulo|indiceChunk` (ver {@link montarChaveResultado}).
 * Quando o mesmo trecho aparece nas duas listas, as duas contribuições RRF são
 * somadas em `scoreFinal` e os scores originais de cada busca são preservados em
 * `scoreFts` e `scoreVetorial`. O campo `indiceCapitulo` é sempre definido como
 * `0`.
 *
 * @param resultadosFts resultados da busca lexical (FTS), ordenados por relevância decrescente
 * @param resultadosVetoriais resultados da busca vetorial, ordenados por relevância decrescente
 * @param topK número máximo de resultados retornados
 * @param pesoFts peso aplicado à contribuição RRF dos resultados de FTS
 * @param pesoVetorial peso aplicado à contribuição RRF dos resultados vetoriais
 * @returns lista fundida e deduplicada, ordenada por `scoreFinal` decrescente e limitada a `topK` itens
 */
export function fundirResultados(
  resultadosFts: ResultadoFts[],
  resultadosVetoriais: ResultadoVetorial[],
  topK: number,
  pesoFts: number,
  pesoVetorial: number,
): ResultadoFinal[] {
  const mapaFinal = new Map<string, ResultadoFinal>();
  const constanteRrf = 60;

  for (const [indice, resultadoFts] of resultadosFts.entries()) {
    const scoreRrf = pesoFts * (1 / (constanteRrf + indice + 1));
    const chave = montarChaveResultado(resultadoFts);
    const existente = mapaFinal.get(chave);

    if (existente) {
      existente.scoreFinal += scoreRrf;
      existente.scoreFts = resultadoFts.scoreFts;
      continue;
    }

    mapaFinal.set(chave, {
      livro: resultadoFts.livro,
      numeroLivro: resultadoFts.numeroLivro,
      indiceCapitulo: 0,
      indiceChunk: resultadoFts.indiceChunk,
      numeroCapitulo: resultadoFts.numeroCapitulo,
      testamento: resultadoFts.testamento,
      texto: resultadoFts.texto,
      scoreFinal: scoreRrf,
      scoreFts: resultadoFts.scoreFts,
    });
  }

  for (const [indice, resultadoVetorial] of resultadosVetoriais.entries()) {
    const scoreRrf = pesoVetorial * (1 / (constanteRrf + indice + 1));
    const chave = montarChaveResultado(resultadoVetorial);
    const existente = mapaFinal.get(chave);

    if (existente) {
      existente.scoreFinal += scoreRrf;
      existente.scoreVetorial = resultadoVetorial.scoreVetorial;
      continue;
    }

    mapaFinal.set(chave, {
      indiceChunk: resultadoVetorial.indiceChunk,
      livro: resultadoVetorial.livro,
      numeroLivro: resultadoVetorial.numeroLivro,
      indiceCapitulo: 0,
      numeroCapitulo: resultadoVetorial.numeroCapitulo,
      testamento: resultadoVetorial.testamento,
      texto: resultadoVetorial.texto,
      scoreFinal: scoreRrf,
      scoreVetorial: resultadoVetorial.scoreVetorial,
    });
  }

  return Array.from(mapaFinal.values())
    .sort((a, b) => b.scoreFinal - a.scoreFinal)
    .slice(0, topK);
}