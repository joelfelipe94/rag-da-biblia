// Espelha `server/lib/eventos.ts`. Mantido em separado porque o cliente tem seu
// próprio tsconfig / bundler e não compartilha o `src/` do projeto.

export type FaseBusca =
  | 'na-fila'
  | 'expandindo-lexica'
  | 'expandindo-parafrase'
  | 'expandindo-hyde'
  | 'buscando'
  | 'fundindo'
  | 'gerando'
  | 'concluido';

export type CanalExpansao = 'lexica' | 'parafrase' | 'hyde';

export type ConsultaExpandida = {
  lexica: string;
  parafrase: string[];
  hyde?: string;
};

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

export type EventoBusca =
  | { tipo: 'estado'; fase: FaseBusca }
  | { tipo: 'expansao-fragmento'; canal: CanalExpansao; texto: string }
  | { tipo: 'expansao-final'; consulta: ConsultaExpandida }
  | { tipo: 'trechos'; trechos: TrechoDTO[] }
  | { tipo: 'resposta-fragmento'; texto: string }
  | { tipo: 'fim'; respostaFinal: string }
  | { tipo: 'erro'; mensagem: string };

export type StatusServidor = {
  estado: 'carregando' | 'pronto' | 'erro';
  disponivel: boolean;
  erro?: string;
  modelo: string;
  modeloEmbedding: string;
  parametros: {
    topK: number;
    topKFts: number;
    topKVetorial: number;
    pesoFts: number;
    pesoVetorial: number;
    pularHyde: boolean;
  };
};

/** Estado acumulado de uma consulta na interface. */
export type Consulta = {
  id: string;
  pergunta: string;
  fase: FaseBusca;
  expansaoBruta: Record<CanalExpansao, string>;
  consultaFinal?: ConsultaExpandida;
  trechos: TrechoDTO[];
  resposta: string;
  erro?: string;
  concluida: boolean;
};
