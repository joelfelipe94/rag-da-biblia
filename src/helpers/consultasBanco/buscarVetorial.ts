import type { EmbeddingModel } from '@lmstudio/sdk';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import type { ResultadoVetorial } from '../../types.js';
import { serializarEmbeddingParaBuffer } from '../serializarEmbeddingParaBuffer.js';
import { montarChaveResultado } from '../montarChaveResultado.js';

/**
 * Executa busca vetorial KNN no SQLite (sqlite-vec) para uma ou mais consultas,
 * consolida resultados duplicados e retorna os melhores itens por score.
 *
 * Fluxo:
 * 1. Gera embeddings para todas as consultas recebidas.
 * 2. Executa KNN em `tabela_embedding_vec` para cada embedding.
 * 3. Deduplica candidatos pela chave de resultado, mantendo a menor distância.
 * 4. Converte distância em score de similaridade e retorna top-N ordenado.
 *
 * Observação de score: para embeddings normalizados, usa a relação
 * `cosine = 1 - (distance^2)/2`.
 *
 * @param caminhoDb Caminho do banco SQLite contendo tabelas de embeddings.
 * @param consultasVetoriais Consultas textuais para gerar embeddings de busca.
 * @param modeloEmbedding Modelo responsável por gerar embeddings das consultas.
 * @param limite Número máximo de resultados finais a retornar.
 * @returns Lista de resultados vetoriais deduplicados e ordenados por score decrescente.
 */
export async function buscarVetorial(
  caminhoDb: string,
  consultasVetoriais: string[],
  modeloEmbedding: EmbeddingModel,
  limite: number,
): Promise<ResultadoVetorial[]> {
  if (consultasVetoriais.length === 0) {
    return [];
  }

  const respostasEmbedding = await modeloEmbedding.embed(consultasVetoriais);
  const embeddingConsultas = respostasEmbedding.map(
    (resposta) => resposta.embedding,
  );

  const banco = new Database(caminhoDb, { readonly: true });

  try {
    sqliteVec.load(banco);

    const consultaKnn = banco.prepare(`
      with semantic_search as (
        SELECT rowid, embedding, distance
        FROM tabela_embedding_vec
        WHERE embedding MATCH ?
        ORDER BY distance
        limit ?
      )
      SELECT
        semantic_search.distance,
        tabela_embedding.numero_capitulo AS "numeroCapitulo",
        tabela_embedding.livro,
        tabela_embedding.id_livro + 1 AS "numeroLivro",
        tabela_embedding.indice_chunk as "indiceChunk",
        tabela_embedding.testamento,
        tabela_embedding.texto
      FROM semantic_search
      join tabela_embedding ON semantic_search.rowid = tabela_embedding.rowid
    `);

    const mapaResultados = new Map<
      string,
      { resultado: ResultadoVetorial; melhorDistancia: number }
    >();

    for (const vetorConsulta of embeddingConsultas) {
      const embeddingBuffer = serializarEmbeddingParaBuffer(vetorConsulta);
      const candidatos = consultaKnn.all(embeddingBuffer, limite) as Array<{
        distance: number;
        numeroCapitulo: number;
        livro: string;
        numeroLivro: number;
        testamento: string;
        texto: string;
        indiceChunk: number;
      }>;

      for (const candidato of candidatos) {
        const chave = montarChaveResultado(candidato);
        const existente = mapaResultados.get(chave);

        // Para embeddings normalizados: distância L2^2 = 2*(1 - cosine), então cosine = 1 - (d^2)/2
        const scoreVetorial = 1 - (candidato.distance * candidato.distance) / 2;

        if (!existente || candidato.distance < existente.melhorDistancia) {
          mapaResultados.set(chave, {
            resultado: {
              livro: candidato.livro,
              numeroLivro: candidato.numeroLivro,
              numeroCapitulo: candidato.numeroCapitulo,
              testamento: candidato.testamento,
              texto: candidato.texto,
              indiceChunk: candidato.indiceChunk,
              scoreVetorial,
            },
            melhorDistancia: candidato.distance,
          });
        }
      }
    }

    return Array.from(mapaResultados.values())
      .map((v) => v.resultado)
      .sort((a, b) => b.scoreVetorial - a.scoreVetorial)
      .slice(0, limite);
  } finally {
    banco.close();
  }
}
