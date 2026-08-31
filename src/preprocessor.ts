#!/usr/bin/env node

import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import { LMStudioClient, type EmbeddingModel } from '@lmstudio/sdk';
import { AutoTokenizer } from '@huggingface/transformers';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { dividirEmChunks } from './helpers/dividirEmChunks.js';
import { carregarSomenteModeloAlvo } from './helpers/search/carregarSomenteModeloAlvo.js';
import { carregarSomenteModeloAlvoEmbedding } from './helpers/search/carregarSomenteModeloAlvoEmbedding.js';
import { serializarEmbeddingParaBuffer } from './helpers/serializarEmbeddingParaBuffer.js';
import { MODELO_ALVO, MODELO_EMBEDDING_ALVO } from './helpers/modelos.js';


function carregarExtensaoSqliteVec(banco: Database.Database): void {
  try {
    sqliteVec.load(banco);
  } catch (err) {
    throw new Error(
      'Erro ao carregar a extensão sqlite-vec. Certifique-se de que a extensão está disponível.',
      { cause: err }
    );
  }
}

/**
 * Executa o fluxo principal do pré-processador.
 *
 * @param argv Argumentos de linha de comando recebidos pelo processo.
 * @returns Promise resolvida quando o processamento termina.
 */
async function main(argv: string[]): Promise<void> {
  const lmStudioClient = new LMStudioClient();
  const MAXIMO_TOKENS_POR_CHUNK = 900;
  // Remove sufixos de quantização e GGUF para obter o tokenizer correto
  const modeloAlvoTokenizer = MODELO_ALVO
    .replace(/-qat$/i, '')
    .replace(/-gguf$/i, '');

  const argumentos = await yargs(hideBin(argv))
    .scriptName('preprocessor')
    .option('input', {
      alias: 'i',
      describe: 'Caminho para o arquivo SQLite com os dados brutos',
      type: 'string',
      demandOption: true,
    })
    .option('output', {
      alias: 'o',
      describe:
        'Caminho para o arquivo SQLite de saída com as tabelas preprocessadas',
      type: 'string',
      demandOption: true,
    })
    .help()
    .strict()
    .parse();

  const inputDb = argumentos.input as string;
  const outputDb = argumentos.output as string;

  const modelo = await carregarSomenteModeloAlvo(lmStudioClient, MODELO_ALVO);
  console.log(`Identificador do modelo: ${modelo.identifier}\n`);

  const modeloEmbedding = await carregarSomenteModeloAlvoEmbedding(
    lmStudioClient,
    MODELO_EMBEDDING_ALVO,
  );
  console.log(`Modelo de embedding carregado: ${modeloEmbedding.identifier}\n`);

  // Carrega todos os capítulos agrupados
  const capitulos = carregaTodosCapitulos(inputDb);
  console.log(`Carregados ${capitulos.length} capítulos\n`);

  // Cria ou limpa as tabelas de saída
  criarTabelasDeProcessamento(outputDb);
  console.log('Tabelas criadas/limpas\n');

  //Carrega o tokenizer do modelo alvo para contagem de tokens
  const tokenizer = await AutoTokenizer.from_pretrained(modeloAlvoTokenizer);

  // Processa cada capítulo
  console.log('Processando capítulos e criando chunks...\n');

  let totalChunks = 0;

  for (let i = 0; i < capitulos.length; i++) {
    const capitulo = capitulos[i];
    if (!capitulo) {
      throw new Error(`Capítulo não encontrado no índice ${i}`);
    }

    const progresso = `[${i + 1}/${capitulos.length}]`;

    // Quebra o capítulo em chunks
    const chunks = await dividirEmChunks(
      capitulo.texto,
      tokenizer,
      MAXIMO_TOKENS_POR_CHUNK
    );

    console.log(
      `${progresso} ${capitulo.testamento} - ${capitulo.livro} Cap ${capitulo.numero_capitulo}:${chunks.length} chunks gerados`,
    );

    totalChunks += chunks.length;

    // Insere os chunks nas tabelas
    await inserirChunksNasTabelas(outputDb, capitulo, chunks, modeloEmbedding);
  }

  console.log(`\nTotal de chunks criados: ${totalChunks}`);
  console.log('Pré-processamento concluído com sucesso!');
}

type Capitulo = {
  testamento: string;
  numero_capitulo: number;
  livro: string;
  id_livro: number;
  id_testamento: number;
  texto: string;
};

type Chunck = Omit<Capitulo, 'texto'> & {
  indice_chunk: number;
  chunk: string;
};

/**
 * Carrega todos os capítulos da base SQLite agrupados por capítulo.
 *
 * @param caminhoDb Caminho para o banco SQLite de entrada
 * @returns Lista de capítulos com textos agrupados de versículos
 */
function carregaTodosCapitulos(caminhoDb: string): Capitulo[] {
  const banco = new Database(caminhoDb, { readonly: true });
  const declaracaoPreparada = banco.prepare(
    `SELECT 
      livro.book_reference_id as id_livro,
      livro.testament_reference_id as id_testamento,
      livro.name as livro,
      verse.chapter as numero_capitulo,
      CASE 
        WHEN livro.testament_reference_id = 1 THEN 'Velho Testamento'
        ELSE 'Novo Testamento' 
      END as testamento,
      GROUP_CONCAT('Versículo ' || verse.verse || ': ' || verse.text, '\n') as texto
    FROM verse
    JOIN book AS livro ON verse.book_id = livro.id
    GROUP BY livro.book_reference_id, verse.chapter
    ORDER BY livro.testament_reference_id, livro.book_reference_id, verse.chapter`,
  );

  const capitulos = declaracaoPreparada.all() as Capitulo[];
  banco.close();

  return capitulos;
}

/**
 * Cria ou limpa as tabelas de full-text search e embedding.
 *
 * @param caminhoDb Caminho para o banco SQLite de saída
 */
function criarTabelasDeProcessamento(caminhoDb: string): void {
  const banco = new Database(caminhoDb);
  carregarExtensaoSqliteVec(banco);

  // Drop das tabelas se existirem
  banco.exec('DROP TABLE IF EXISTS tabela_fts');
  banco.exec('DROP TABLE IF EXISTS tabela_embedding');
  banco.exec('DROP TABLE IF EXISTS tabela_embedding_vec');

  // Cria tabela virtual FTS5
  banco.exec(`
    CREATE VIRTUAL TABLE tabela_fts USING fts5(
      numero_capitulo,
      livro,
      id_livro,
      testamento,
      id_testamento,
      texto,
      indice_chunk,
    )
  `);

  // Cria tabela de metadados com referência ao vec_rowid
  banco.exec(`
    CREATE TABLE tabela_embedding (
      id INTEGER PRIMARY KEY,
      numero_capitulo INTEGER,
      livro TEXT,
      id_livro INTEGER,
      testamento TEXT,
      id_testamento INTEGER,
      texto TEXT,
      indice_chunk INTEGER,
      vec_rowid INTEGER
    )
  `);

  // Cria tabela virtual sqlite-vec para os embeddings (1024 dimensões)
  try {
    banco.exec(`
      CREATE VIRTUAL TABLE tabela_embedding_vec USING vec0(
        embedding float(1024)
      )
    `);
  } catch (err) {
    throw new Error('Erro ao criar tabela tabela_embedding_vec.', {
      cause: err,
    });
  }

  banco.close();
}

/**
 * Insere os chunks nas tabelas de FTS e Embedding com sqlite-vec.
 *
 * @param caminhoDb Caminho para o banco SQLite de saída
 * @param capitulo Informações do capítulo
 * @param chunks Array de chunks a serem inseridos
 */
function inserirChunksNasTabelas(
  caminhoDb: string,
  capitulo: Capitulo,
  chunks: string[],
  modeloEmbedding: EmbeddingModel,
): Promise<void> {
  const banco = new Database(caminhoDb);

  carregarExtensaoSqliteVec(banco);

  const insertFts = banco.prepare(`
    INSERT INTO tabela_fts(numero_capitulo, livro, id_livro, testamento, id_testamento, texto, indice_chunk)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMetadata = banco.prepare(`
    INSERT INTO tabela_embedding(numero_capitulo, livro, id_livro, testamento, id_testamento, texto, indice_chunk, vec_rowid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Insere no vec0 sem especificar rowid, deixa ele gerar
  const insertEmbedding = banco.prepare(`
    INSERT INTO tabela_embedding_vec(embedding)
    VALUES (?)
  `);

  return (async () => {
    try {
      const timeBefore = performance.now();
      const chunksComContexto: Chunck[] = chunks.map((chunk, index) => ({
        id_livro: capitulo.id_livro,
        livro: capitulo.livro,
        id_testamento: capitulo.id_testamento,
        testamento: capitulo.testamento,
        numero_capitulo: capitulo.numero_capitulo,
        indice_chunk: index,
        chunk,
      }));
      const chunksComContextoJson = chunksComContexto.map((chunkComContext) =>
        JSON.stringify(chunkComContext),
      );
      const embeddings = await modeloEmbedding.embed(chunksComContextoJson);
      const timeAfter = performance.now();
      console.log(`Tempo para gerar embeddings: ${timeAfter - timeBefore} ms`);

      const transaction = banco.transaction(() => {
        for (const [index, chunk] of chunks.entries()) {
          const embeddingGerado = embeddings[index];
          if (!embeddingGerado) {
            throw new Error(`Embedding não encontrado para o chunk ${index}`);
          }

          // Insere em FTS
          insertFts.run(
            capitulo.numero_capitulo,
            capitulo.livro,
            capitulo.id_livro,
            capitulo.testamento,
            capitulo.id_testamento,
            chunk,
            index,
          );

          // Insere embedding no vec0 primeiro (sem rowid, deixa gerar)
          const embeddingBuffer = serializarEmbeddingParaBuffer(
            embeddingGerado.embedding,
          );

          insertEmbedding.run(embeddingBuffer);

          // Recupera o rowid gerado pelo vec0
          const lastRowId = banco
            .prepare('SELECT last_insert_rowid() as id')
            .get() as {id: number};
          const vecRowId = Number(lastRowId.id);

          // Insere metadados na tabela regular com a referência ao vec_rowid
          insertMetadata.run(
            capitulo.numero_capitulo,
            capitulo.livro,
            capitulo.id_livro,
            capitulo.testamento,
            capitulo.id_testamento,
            chunk,
            index,
            vecRowId,
          );
        }
      });
      transaction();
    } finally {
      banco.close();
    }
  })();
}

main(process.argv).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
