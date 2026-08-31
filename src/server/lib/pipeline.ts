import { Chat, type LLM, type EmbeddingModel } from '@lmstudio/sdk';

import type { ConsultaExpandida, ResultadoFinal } from '../../types.js';
import { gerarPromptRespostaFinal } from '../../systemPrompts.js';
import { produzirConsultaParaFTS } from '../../helpers/search/produzirConsultaParaFTS.js';
import { produzirParafraseParaBuscaEmbedding } from '../../helpers/search/produzirParafraseParaBuscaEmbedding.js';
import { produzirDocumentoHipoteticoParaBuscaEmbedding } from '../../helpers/search/produzirDocumentoHipoteticoParaBuscaEmbedding.js';
import { buscarFts } from '../../helpers/consultasBanco/buscarFts.js';

import type { ParametrosServidor } from '../../helpers/carregarParametrosDoServidor.js';
import { instrumentarModelo } from './instrumentarModelo.js';
import type { EmissorEvento, TrechoDTO } from './eventos.js';
import { buscarVetorial } from '../../helpers/consultasBanco/buscarVetorial.js';
import { fundirResultados } from '../../helpers/search/fundirResultados.js';

type OpcoesBusca = {
  query: string;
  parametros: ParametrosServidor;
  modelo: LLM;
  modeloEmbedding: EmbeddingModel;
  emitir: EmissorEvento;
  estaAbortado: () => boolean;
};

/**
 * Executa o fluxo de expansão da consulta, busca FTS + vetorial, fusão RRF
 * e geração da resposta final — emitindo eventos em tempo real (tokens,
 * expansão e trechos).
 */
export async function executarBusca(opcoes: OpcoesBusca): Promise<void> {
  const { query, parametros, modelo, modeloEmbedding, emitir, estaAbortado } =
    opcoes;
  const caminhoDb = parametros.caminhoDb;

  // 1. Expansão da consulta (equivalente a `produzirConsultaExpandida`).
  emitir({ tipo: 'estado', fase: 'expandindo-lexica' });
  const modeloLexica = instrumentarModelo(modelo, (texto) =>
    emitir({ tipo: 'expansao-fragmento', canal: 'lexica', texto }),
  );
  const lexica = await produzirConsultaParaFTS(modeloLexica, query, caminhoDb);
  if (estaAbortado()) return;

  emitir({ tipo: 'estado', fase: 'expandindo-parafrase' });
  const modeloParafrase = instrumentarModelo(modelo, (texto) =>
    emitir({ tipo: 'expansao-fragmento', canal: 'parafrase', texto }),
  );
  const parafrase = await produzirParafraseParaBuscaEmbedding(
    modeloParafrase,
    query,
  );
  if (estaAbortado()) return;

  let hyde: string | undefined;
  if (!parametros.pularHyde) {
    emitir({ tipo: 'estado', fase: 'expandindo-hyde' });
    const modeloHyde = instrumentarModelo(modelo, (texto) =>
      emitir({ tipo: 'expansao-fragmento', canal: 'hyde', texto }),
    );
    hyde = await produzirDocumentoHipoteticoParaBuscaEmbedding(modeloHyde, query);
    if (estaAbortado()) return;
  }

  const consultaExpandida: ConsultaExpandida = hyde
    ? { lexica, parafrase, hyde }
    : { lexica, parafrase };
  emitir({ tipo: 'expansao-final', consulta: consultaExpandida });

  // 2. Buscas lexical e vetorial.
  emitir({ tipo: 'estado', fase: 'buscando' });
  const resultadosFts = buscarFts(caminhoDb, lexica, parametros.topKFts);
  const consultasVetoriais = [
    ...parafrase,
    ...(hyde ? [hyde] : []),
  ];
  const resultadosVetoriais = await buscarVetorial(
    caminhoDb,
    consultasVetoriais,
    modeloEmbedding,
    parametros.topKVetorial,
  );
  if (estaAbortado()) return;

  // 3. Fusão ponderada RRF.
  emitir({ tipo: 'estado', fase: 'fundindo' });
  const capitulosEncontrados = fundirResultados(
    resultadosFts,
    resultadosVetoriais,
    parametros.topK,
    parametros.pesoFts,
    parametros.pesoVetorial,
  );
  emitir({
    tipo: 'trechos',
    trechos: capitulosEncontrados.map(paraTrechoDTO),
  });
  if (estaAbortado()) return;

  // 4. Resposta final com base nos trechos (streaming token a token).
  emitir({ tipo: 'estado', fase: 'gerando' });
  const chat = Chat.from([
    { role: 'system', content: gerarPromptRespostaFinal(capitulosEncontrados) },
    { role: 'user', content: query },
  ]);
  const predicao = modelo.respond(chat, { preset: 'no-thinking' });
  for await (const { content } of predicao) {
    if (estaAbortado()) {
      await predicao.cancel().catch(() => undefined);
      return;
    }
    if (content) {
      emitir({ tipo: 'resposta-fragmento', texto: content });
    }
  }
  const resposta = await predicao;

  emitir({ tipo: 'estado', fase: 'concluido' });
  emitir({ tipo: 'fim', respostaFinal: resposta.nonReasoningContent });
}

function paraTrechoDTO(
  resultado: ResultadoFinal,
  indice: number,
): TrechoDTO {
  const dto: TrechoDTO = {
    id: `${resultado.testamento}|${resultado.livro}|${resultado.numeroCapitulo}|${resultado.indiceChunk}|${indice}`,
    referencia: `${resultado.livro} ${resultado.numeroCapitulo}`,
    testamento: resultado.testamento,
    livro: resultado.livro,
    numeroLivro: resultado.numeroLivro,
    numeroCapitulo: resultado.numeroCapitulo,
    indiceChunk: resultado.indiceChunk,
    texto: resultado.texto,
    scoreFinal: resultado.scoreFinal,
  };
  if (typeof resultado.scoreFts === 'number') {
    dto.scoreFts = resultado.scoreFts;
  }
  if (typeof resultado.scoreVetorial === 'number') {
    dto.scoreVetorial = resultado.scoreVetorial;
  }
  return dto;
}
