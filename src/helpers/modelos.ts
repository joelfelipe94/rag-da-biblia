import type { LLMPredictionConfigInput } from '@lmstudio/sdk';

/**
 * Identificadores dos modelos LM Studio usados pelo servidor.
 *
 * Espelham exatamente as constantes fixas em `src/searchBible.ts` (que não são
 * exportadas). Se você trocar os modelos lá, troque aqui também.
 */
export const MODELO_ALVO = 'google/gemma-4-12b-qat';

export const MODELO_EMBEDDING_ALVO =
  'text-embedding-multilingual-e5-large-instruct';

/**
 * Configuração de inferência do LM Studio para que o modelo não realize raciocínio.
 *
 * Isso faz com que o modelo seja mais rápido, pois não realiza raciocínio complexo.
 */
export const OPCOES_SEM_RACIOCINIO = {
  raw: {
    fields: [
      {
        key: 'ext.virtualModel.customField.google.gemma412bQat.enableThinking',
        value: false,
      },
    ],
  },
} satisfies LLMPredictionConfigInput;
