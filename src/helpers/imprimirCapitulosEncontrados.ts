import { resumirTexto } from '../searchBible.js';
import type { ResultadoFinal } from '../types.js';

/**
 * Imprime um resumo dos documentos encontrados.
 *
 * @param resultadosFinais
 * @return {*}
 */
export function imprimirCapitulosEncontrados(
  resultadosFinais: ResultadoFinal[]): void {
  if (resultadosFinais.length === 0) {
    console.log('\nNenhum resultado encontrado para a consulta informada.');
    return;
  }

  console.log(`\nTop ${resultadosFinais.length} resultados:`);
  for (const [indice, resultado] of resultadosFinais.entries()) {
    const trechoResumido = resumirTexto(resultado.texto, 240);
    console.log(
      `\n${indice + 1}. ${resultado.testamento} - ${resultado.livro} ${resultado.numeroCapitulo}`
    );
    console.log(`   score_final=${resultado.scoreFinal.toFixed(6)}`);
    if (typeof resultado.scoreFts === 'number') {
      console.log(`   score_fts=${resultado.scoreFts.toFixed(6)}`);
    }
    if (typeof resultado.scoreVetorial === 'number') {
      console.log(`   score_vetorial=${resultado.scoreVetorial.toFixed(6)}`);
    }
    console.log(`   trecho=${trechoResumido}`);
  }
}
