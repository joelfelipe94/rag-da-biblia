import type { ConsultaExpandida } from '../../types.js';

/** Fases pelas quais uma consulta passa, do início à resposta final. */
export type FaseBusca =
  | 'na-fila'
  | 'expandindo-lexica'
  | 'expandindo-parafrase'
  | 'expandindo-hyde'
  | 'buscando'
  | 'fundindo'
  | 'gerando'
  | 'concluido';

/** Canais de expansão da consulta (correspondem aos helpers de `src/helpers/search`). */
export type CanalExpansao = 'lexica' | 'parafrase' | 'hyde';

/** Trecho da Bíblia recuperado, no formato enviado ao cliente. */
export type TrechoDTO = {
  id: string;
  referencia: string;
  testamento: string;
  livro: string;
  numeroLivro: number;
  numeroCapitulo: number;
  indiceChunk: number;
  texto: string;
  scoreFinal: number;
  scoreFts?: number;
  scoreVetorial?: number;
};

/**
 * Eventos transmitidos pelo endpoint SSE `GET /api/search`. Cada mensagem SSE
 * carrega um destes objetos serializado em JSON no campo `data:`.
 */
export type EventoBusca =
  | { tipo: 'estado'; fase: FaseBusca }
  | { tipo: 'expansao-fragmento'; canal: CanalExpansao; texto: string }
  | { tipo: 'expansao-final'; consulta: ConsultaExpandida }
  | { tipo: 'trechos'; trechos: TrechoDTO[] }
  | { tipo: 'resposta-fragmento'; texto: string }
  | { tipo: 'fim'; respostaFinal: string }
  | { tipo: 'erro'; mensagem: string };

export type EmissorEvento = (evento: EventoBusca) => void;
