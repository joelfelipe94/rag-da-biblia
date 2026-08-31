/**
 * Identificadores dos modelos LM Studio usados pelo servidor.
 *
 * Espelham exatamente as constantes fixas em `src/searchBible.ts` (que não são
 * exportadas). Se você trocar os modelos lá, troque aqui também.
 */
export const MODELO_ALVO = 'google/gemma-4-12b-qat';

export const MODELO_EMBEDDING_ALVO =
  'text-embedding-multilingual-e5-large-instruct';
