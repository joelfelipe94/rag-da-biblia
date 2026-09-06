import { Chat, type LLM } from '@lmstudio/sdk';
import Database from 'better-sqlite3';
import { PROMPT_CONSULTA_FTS5 } from '../../systemPrompts.js';
import { OPCOES_SEM_RACIOCINIO } from '../modelos.js';

/**
 * Produz uma consulta FTS a partir da consulta do usuário.
 * 
 * Repete a geração da consulta até que o modelo produza uma consulta válida ou atinja o número máximo de tentativas.
 *
 * @param modelo modelo LLM para gerar os termos de busca
 * @param consultaOriginal consulta original do usuário
 * @param caminhoDb caminho para o banco de dados SQLite. Usado apenas para validar a consulta gerada pelo modelo
 * @return {*} consulta FTS gerada pelo modelo
 */
export async function produzirConsultaParaFTS(
  modelo: LLM,
  consultaOriginal: string,
  caminhoDb: string,
): Promise<string> {
  const chat = Chat.from([
    {
      role: 'system',
      content: PROMPT_CONSULTA_FTS5,
    },
    {
      role: 'user',
      content: consultaOriginal,
    },
  ]);
  console.log('\nGerando consulta FTS a partir da consulta do usuário:');
  const maximoTentativas = 3;
  for (let tentativa = 1; tentativa <= maximoTentativas; tentativa++) {
    const predicao = modelo.respond(chat, OPCOES_SEM_RACIOCINIO);
    let tamanhoResultadoParcial = 0;
    for await (const { content } of predicao) {
      process.stdout.write(content);
      tamanhoResultadoParcial += content.length;
      if (tamanhoResultadoParcial > 300) {
        // Sai do loop se a consulta gerada pelo modelo exceder 300 caracteres
        break;
      }
    }
    if (tamanhoResultadoParcial > 300) {
      console.log(
        'A consulta gerada pelo modelo excedeu 300 caracteres. Limitando a saída.',
      );
      continue; // Vai para a próxima tentativa
    }
    process.stdout.write('\n');
    const resposta = await predicao;
    const conteudoSemReasoning = resposta.nonReasoningContent.trim();
    const consultaValida = verificaConsulta(caminhoDb, conteudoSemReasoning);
    // Se a consulta gerada pelo modelo não for válida, tenta novamente até atingir o número máximo de tentativas
    if (consultaValida) {
      return conteudoSemReasoning.trim();
    }
    console.log(`A consulta gerada pelo modelo não é válida. Tentativa ${tentativa} de ${maximoTentativas}.`);
  }
  throw new Error(
    `O modelo não conseguiu gerar uma consulta FTS válida após ${maximoTentativas} tentativas.`,
  );
}

function verificaConsulta(caminhoDb: string, consultaLexica: string): boolean {
  const banco = new Database(caminhoDb, { readonly: true });

  try {
    banco
      .prepare(
        `SELECT 1
       FROM tabela_fts
       WHERE tabela_fts MATCH ?
       LIMIT 0`,
      )
      .all(consultaLexica);
    return true;
  } catch (error) {
    return false;
  } finally {
    banco.close();
  }
}
