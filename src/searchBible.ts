import { gerarPromptRespostaFinal } from './systemPrompts.js';

import { Chat, LMStudioClient, type LLM } from '@lmstudio/sdk';

import type {
  ConsultaExpandida,
  ResultadoFinal,
} from './types.js';
import { carregarSomenteModeloAlvo } from './helpers/search/carregarSomenteModeloAlvo.js';
import { carregarSomenteModeloAlvoEmbedding } from './helpers/search/carregarSomenteModeloAlvoEmbedding.js';
import { produzirConsultaParaFTS } from './helpers/search/produzirConsultaParaFTS.js';
import { produzirParafraseParaBuscaEmbedding } from './helpers/search/produzirParafraseParaBuscaEmbedding.js';
import { produzirDocumentoHipoteticoParaBuscaEmbedding } from './helpers/search/produzirDocumentoHipoteticoParaBuscaEmbedding.js';
import { carregarParametrosDoComando } from './helpers/carregarParametrosDoComando.js';
import { buscarFts } from './helpers/consultasBanco/buscarFts.js';
import { buscarVetorial } from './helpers/consultasBanco/buscarVetorial.js';
import { imprimirCapitulosEncontrados } from './helpers/imprimirCapitulosEncontrados.js';
import { renderizarMarkdownNoTerminal } from './helpers/renderizarMarkdownNoTerminal.js';
import { fundirResultados } from './helpers/search/fundirResultados.js';
import {
  MODELO_ALVO,
  MODELO_EMBEDDING_ALVO,
  OPCOES_SEM_RACIOCINIO,
} from './helpers/modelos.js';

async function main(argv: string[]): Promise<void> {
  const lmStudioClient = new LMStudioClient();
  const {
    consultaOriginal,
    pularHyde,
    caminhoDb,
    topKFts,
    topKVetorial,
    topK,
    pesoFts,
    pesoVetorial,
  } = await carregarParametrosDoComando(argv);


  const modelo = await carregarSomenteModeloAlvo(lmStudioClient, MODELO_ALVO);

  const modeloEmbedding = await carregarSomenteModeloAlvoEmbedding(
    lmStudioClient,
    MODELO_EMBEDDING_ALVO
  );

  const consultaExpandida = await produzirConsultaExpandida(
    modelo,
    consultaOriginal,
    pularHyde,
    caminhoDb,
  );

  console.log('\nConsultas utilizadas na busca:');
  console.log(`- [lexica] ${consultaExpandida.lexica}`);
  console.log(`- [parafrase] ${consultaExpandida.parafrase.join('; ')}`);
  if (consultaExpandida.hyde) {
    console.log(`- [hyde] ${consultaExpandida.hyde}`);
  }

  const resultadosFts = buscarFts(caminhoDb, consultaExpandida.lexica, topKFts);

  // Combina as consultas para busca vetorial: todas as paráfrases e, se existir, o documento hipotético (hyde)
  const consultasVetoriais = [
    ...consultaExpandida.parafrase,
    ...(consultaExpandida.hyde ? [consultaExpandida.hyde] : []),
  ];
  const resultadosVetoriais = await buscarVetorial(
    caminhoDb,
    consultasVetoriais,
    modeloEmbedding,
    topKVetorial,
  );

  const capitulosEncontrados = fundirResultados(
    resultadosFts,
    resultadosVetoriais,
    topK,
    pesoFts,
    pesoVetorial,
  );

  imprimirCapitulosEncontrados(capitulosEncontrados);
  const respostaComBaseNosDocumentos =
    await produzirRespostaComBaseNosDocumentos(
      modelo,
      consultaOriginal,
      capitulosEncontrados,
    );
  console.log('\nResposta com base na biblia:');
  console.log(renderizarMarkdownNoTerminal(respostaComBaseNosDocumentos));
}


async function produzirRespostaComBaseNosDocumentos(
  modelo: LLM,
  consultaOriginal: string,
  capitulosEncontrados: ResultadoFinal[],
): Promise<string> {
  const chat = Chat.from([
    {
      role: 'system',
      content: gerarPromptRespostaFinal(capitulosEncontrados),
    },
    {
      role: 'user',
      content: consultaOriginal,
    },
  ]);

  console.log('\nGerando resposta com base nos documentos encontrados:');
  const predicao = modelo.respond(chat, OPCOES_SEM_RACIOCINIO);
  // Renderiza o Markdown por linha completa: `**` e o bullet `*` só podem ser
  // resolvidos depois que a linha inteira chegou do streaming.
  let bufferLinha = '';
  for await (const { content } of predicao) {
    bufferLinha += content;
    let quebra = bufferLinha.indexOf('\n');
    while (quebra !== -1) {
      process.stdout.write(
        `${renderizarMarkdownNoTerminal(bufferLinha.slice(0, quebra))}\n`,
      );
      bufferLinha = bufferLinha.slice(quebra + 1);
      quebra = bufferLinha.indexOf('\n');
    }
  }
  if (bufferLinha.length > 0) {
    process.stdout.write(renderizarMarkdownNoTerminal(bufferLinha));
  }
  process.stdout.write('\n');
  const resposta = await predicao;
  return resposta.nonReasoningContent;
}

async function produzirConsultaExpandida(
  modelo: LLM,
  consultaOriginal: string,
  pularHyde: boolean,
  caminhoDb: string,
): Promise<ConsultaExpandida> {
  const consultaFTS = await produzirConsultaParaFTS(
    modelo,
    consultaOriginal,
    caminhoDb,
  );
  const parafrasesEmbedding: string[] =
    await produzirParafraseParaBuscaEmbedding(modelo, consultaOriginal);
  if (pularHyde) {
    console.info('Pulando geração do documento hipotético (HyDE)');
    return {
      lexica: consultaFTS,
      parafrase: parafrasesEmbedding,
    };
  }
  const documentoHipotetico: string =
    await produzirDocumentoHipoteticoParaBuscaEmbedding(
      modelo,
      consultaOriginal,
    );

  const consultasExpandidas: ConsultaExpandida = {
    lexica: consultaFTS,
    parafrase: parafrasesEmbedding,
    hyde: documentoHipotetico,
  };

  return consultasExpandidas;
}



export function resumirTexto(texto: string, limite: number): string {
  const normalizado = texto.replace(/\s+/g, ' ').trim();
  if (normalizado.length <= limite) {
    return normalizado;
  }

  return `${normalizado.slice(0, limite - 3)}...`;
}

export function montarChaveResultado({
  testamento,
  livro,
  numeroCapitulo,
  indiceChunk,
}: {
  testamento: string;
  livro: string;
  numeroCapitulo: number;
  indiceChunk: number;
}): string {
  return `${testamento}|${livro}|${numeroCapitulo}|${indiceChunk}`;
}



main(process.argv).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
