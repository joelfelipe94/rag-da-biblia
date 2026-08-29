import Database from 'better-sqlite3';
import type { ResultadoFts } from '../../types.js';

/**
 * Executa uma consulta Full-Text Search (FTS) na base SQLite e retorna os
 * chunks mais relevantes ordenados por score BM25.
 *
 * A conexão é aberta em modo somente leitura e sempre fechada ao final,
 * inclusive em caso de erro.
 *
 * @param caminhoDb Caminho do arquivo SQLite com a tabela FTS.
 * @param consultaLexica Consulta no formato aceito pelo operador MATCH do FTS.
 * @param limite Quantidade máxima de resultados a retornar.
 * @returns Lista de resultados FTS contendo metadados do trecho e score.
 */
export function buscarFts(
  caminhoDb: string,
  consultaLexica: string,
  limite: number): ResultadoFts[] {
  const banco = new Database(caminhoDb, { readonly: true });

  try {
    const consulta = banco.prepare(
      `SELECT livro, numero_capitulo as "numeroCapitulo", id_livro + 1 as "numeroLivro", testamento, indice_chunk as "indiceChunk", texto, bm25(tabela_fts) AS "scoreFts"
       FROM tabela_fts
       WHERE tabela_fts MATCH ?
       ORDER BY "scoreFts"
       LIMIT ?`
    );
    const resultadosFtsQuery = consulta.all(
      consultaLexica,
      limite
    ) as ResultadoFts[];

    return resultadosFtsQuery;
  } finally {
    banco.close();
  }
}
