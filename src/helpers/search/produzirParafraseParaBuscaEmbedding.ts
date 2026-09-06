import type { LLM, OngoingPrediction } from "@lmstudio/sdk";
import { Chat } from "@lmstudio/sdk";
import { PROMPT_PARAFRASE } from "../../systemPrompts.js";
import { OPCOES_SEM_RACIOCINIO } from "../modelos.js";

/**
 * Produz paráfrases semânticas para busca por embedding a partir da consulta do usuário. Deve ser no máximo 3 linhas, cada linha com uma paráfrase semântica.
 * 
 * Caso o modelo produza mais de 3 linhas ou uma linha com mais de 300 caracteres ou nenhuma linha, o processo é repetido até que o modelo produza uma resposta
 *  válida ou atinja o número máximo de tentativas.
 *
 * @param modelo modelo LLM para gerar as paráfrases
 * @param consultaOriginal consulta original do usuário
 * @return {*} paráfrases semânticas para busca por embedding geradas pelo modelo
 */
export async function produzirParafraseParaBuscaEmbedding(
  modelo: LLM,
  consultaOriginal: string,
): Promise<string[]> {
  const chat = Chat.from([
    {
      role: 'system',
      content: PROMPT_PARAFRASE,
    },
    {
      role: 'user',
      content: consultaOriginal,
    },
  ]);

  const predicao = modelo.respond(chat, OPCOES_SEM_RACIOCINIO);
  console.log('\nGerando paráfrases semânticas para busca por embedding:');
  let resultado: string[] = [];
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      resultado = await processarParafrase(predicao);
      break; // Sai do loop se a resposta for válida
    } catch (error) {
      if (tentativa < 3) {
        console.warn(
          `Erro ao processar a resposta do modelo na tentativa ${tentativa} de 3:`,
          error,
        );
      }
      if (tentativa === 3) {
        throw new Error(
          'O modelo não conseguiu produzir paráfrases válidas após 3 tentativas.',
          { cause: error },
        );
      }
    }
  }
  return resultado;
}

async function processarParafrase(predicao: OngoingPrediction<unknown>): Promise<string[]> {
  let linhaAtual = 1;
  let tamanhoRespostaParcial = 0;
  for await (const { content } of predicao) {
    process.stdout.write(content);
    const [antesDaQuebraDeLinha, ...depoisDaQuebraDeLinha] = content.split('\n');
    tamanhoRespostaParcial += antesDaQuebraDeLinha?.length ?? 0;
    // Verifica se a linha atual excede 500 caracteres ou se há mais de 3 linhas
    // O prompt do sistema diz para o modelo produzir no maximo 300 caracteres, mas o modelo pode produzir mais, então é necessário verificar.
    // A margem de 200 caracteres se deve ao fato de que o modelo não é bom em contagem de caracteres, então é melhor ser mais permissivo.
    if (tamanhoRespostaParcial > 500) {
      throw new Error(
        'O modelo produziu uma linha de paráfrase com mais de 500 caracteres, o que não é permitido.',
      );
    }
    if (depoisDaQuebraDeLinha.length > 0) {
      linhaAtual += depoisDaQuebraDeLinha.filter((linha:string) => linha.length > 0).length;
      if (linhaAtual > 3) {
        throw new Error(
          'O modelo produziu mais de 3 linhas de paráfrases, o que não é permitido.',
        );
      }
    }

  }
  // Aguarda a conclusão da predição para processar o resultado final
  const resposta = await predicao;
  const parafrases = resposta.nonReasoningContent
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0);
  if (parafrases.length === 0) {
    throw new Error(
      'O modelo não produziu nenhuma paráfrase para busca por embedding.',
    );
  } 
  return parafrases;
}