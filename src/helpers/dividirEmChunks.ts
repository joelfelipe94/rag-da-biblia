import type { PreTrainedTokenizer } from '@huggingface/transformers';
import assert from 'node:assert';

/**
 * Divide um texto em chunks usando a contagem de tokens.
 * Cada chunk termina em quebra de linha.
 * O chunk seguinte começa com a última linha do chunk anterior (overlap em nível de linhas).
 *
 * @param texto Texto completo a ser dividido
 * @param tokenizer Tokenizer pré-treinado
 * @param maxTokens Número máximo de tokens por chunk
 * @returns Array de chunks
 */

export async function dividirEmChunks(
  texto: string,
  tokenizer: PreTrainedTokenizer,
  maxTokens: number
): Promise<string[]> {

  const tokens = await tokenizer.encode(texto);
  if (tokens.length <= maxTokens) {
    return [texto];
  }
  const chunks: string[] = [];
  const linhas: { texto: string; numeroTokens: number; }[] = texto.split('\n').map((linha) => ({
    texto: linha,
    numeroTokens: tokenizer.encode(linha).length,
  }));
  let chunk: { linhas: string[]; numeroTokens: number; } = { linhas: [], numeroTokens: 0 };
  let linhaAnterior: { texto: string; numeroTokens: number; } | null = null;
  for (const linha of linhas) {
    if (chunk.numeroTokens + (linha.numeroTokens + 1) <= maxTokens) {
      chunk.linhas.push(linha.texto);
      // +1 para a quebra de linha. Esse é o pior caso, já que a quebra de linha pode fazer
      //  parte de um outro token, mas é uma aproximação razoável.
      chunk.numeroTokens += linha.numeroTokens + 1;
    }
    else {
      if (chunk.linhas.length > 0) {
        chunks.push(chunk.linhas.join('\n'));
      }
      // Inicia um novo chunk com a linha atual. Para garantir o overlap de uma linha.
      assert(linhaAnterior !== null, 'Linha anterior não pode ser nula ao iniciar um novo chunk');
      assert(linhaAnterior.numeroTokens + linha.numeroTokens + 1 <= maxTokens,
        'Linha anterior e atual juntas excedem o limite de tokens. Isso não deveria acontecer.');
      chunk = { linhas: [linhaAnterior.texto, linha.texto], numeroTokens: linhaAnterior.numeroTokens + linha.numeroTokens + 1 };
    }
    linhaAnterior = linha;
  }
  // Adiciona o último chunk se houver. 
  // Se o último chunk tiver apenas uma linha, ele será descartado, pois é apenas a última linha do chunk anterior.
  if (chunk.linhas.length > 0) {
    chunks.push(chunk.linhas.join('\n'));
  }
  return chunks;
}
