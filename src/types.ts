export type ConsultaExpandida = {
  lexica: string;
  parafrase: string[];
  hyde?: string;
};

export type ResultadoFts = {
  indiceChunk: number;
  livro: string;
  numeroLivro: number;
  numeroCapitulo: number;
  testamento: string;
  texto: string;
  scoreFts: number;
};

export type ResultadoVetorial = {
  indiceChunk: number;
  livro: string;
  numeroLivro: number;
  numeroCapitulo: number;
  testamento: string;
  texto: string;
  scoreVetorial: number;
};

export type ResultadoFinal = {
  indiceChunk: number;
  livro: string;
  numeroLivro: number;
  indiceCapitulo: number;
  numeroCapitulo: number;
  testamento: string;
  texto: string;
  scoreFinal: number;
  scoreFts?: number;
  scoreVetorial?: number;
};