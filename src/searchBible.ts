import { gerarPromptRespostaFinal } from './systemPrompts.js';

import { Chat, LMStudioClient, type LLM } from '@lmstudio/sdk';

import type {
  ConsultaExpandida,
  ResultadoFts,
  ResultadoVetorial,
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

async function main(argv: string[]): Promise<void> {
  const lmStudioClient = new LMStudioClient();
  // Modelo utilizado para expandir a consulta do usuário (gerar consulta FTS, paráfrases e documento hipotético)
  // e para gerar a resposta final com base nos documentos encontrados.
  const modeloAlvo = 'google/gemma-4-12b-qat';

  // Modelo utilizado para gerar embeddings para busca vetorial
  const modeloEmbeddingAlvo = 'text-embedding-multilingual-e5-large-instruct';

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


  const modelo = await carregarSomenteModeloAlvo(lmStudioClient, modeloAlvo);

  const modeloEmbedding = await carregarSomenteModeloAlvoEmbedding(
    lmStudioClient,
    modeloEmbeddingAlvo
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
  console.log(respostaComBaseNosDocumentos);
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
  const predicao = modelo.respond(chat, { preset: 'no-thinking' });
  for await (const { content } of predicao) {
    process.stdout.write(content);
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

export function serializarEmbeddingParaVec(embedding: number[]): Buffer {
  const float32 = new Float32Array(embedding);
  return Buffer.from(float32.buffer, float32.byteOffset, float32.byteLength);
}

function fundirResultados(
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
