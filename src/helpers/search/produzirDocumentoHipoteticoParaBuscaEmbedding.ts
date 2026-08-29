import { type LLM, Chat } from '@lmstudio/sdk';
import { PROMPT_HYDE } from '../../systemPrompts.js';

/**
 * Gera um documento hipotético (HyDE) a partir da consulta original para
 * melhorar a recuperação semântica por embedding.
 *
 * A função envia a consulta ao modelo com o prompt de sistema `PROMPT_HYDE`,
 * transmite os chunks de resposta para stdout em tempo real e retorna o texto
 * final sem espaços extras nas extremidades.
 *
 * @param modelo Modelo LLM já carregado no LM Studio.
 * @param consultaOriginal Pergunta original do usuário.
 * @returns Documento hipotético gerado pelo modelo, com `trim()` aplicado.
 */
export async function produzirDocumentoHipoteticoParaBuscaEmbedding(
  modelo: LLM,
  consultaOriginal: string): Promise<string> {
  const chat = Chat.from([
    {
      role: 'system',
      content: PROMPT_HYDE,
    },
    {
      role: 'user',
      content: consultaOriginal,
    },
  ]);
  console.log(
    '\nGerando documento hipotético (HyDE) para busca por embedding:'
  );
  const predicao = modelo.respond(chat, { preset: 'no-thinking' });
  for await (const { content } of predicao) {
    process.stdout.write(content);
  }
  process.stdout.write('\n');
  const resposta = await predicao;
  return resposta.nonReasoningContent.trim();
}
