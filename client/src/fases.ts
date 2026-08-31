import type { FaseBusca } from './tipos';

export const ROTULO_FASE: Record<FaseBusca, string> = {
  'na-fila': 'Na fila…',
  'expandindo-lexica': 'Gerando consulta lexical (FTS5)…',
  'expandindo-parafrase': 'Gerando paráfrases semânticas…',
  'expandindo-hyde': 'Gerando documento hipotético (HyDE)…',
  buscando: 'Buscando trechos (FTS + vetorial)…',
  fundindo: 'Fundindo resultados (RRF)…',
  gerando: 'Escrevendo a resposta com base na Bíblia…',
  concluido: 'Concluído',
};

export const ORDEM_FASE: FaseBusca[] = [
  'na-fila',
  'expandindo-lexica',
  'expandindo-parafrase',
  'expandindo-hyde',
  'buscando',
  'fundindo',
  'gerando',
  'concluido',
];

export function faseConcluida(faseAtual: FaseBusca, fase: FaseBusca): boolean {
  return ORDEM_FASE.indexOf(faseAtual) > ORDEM_FASE.indexOf(fase);
}
