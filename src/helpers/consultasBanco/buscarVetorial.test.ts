import type { EmbeddingModel } from '@lmstudio/sdk';

const mockDatabase = jest.fn();
const mockSqliteVecLoad = jest.fn();
const mockSerializarEmbeddingParaVec = jest.fn();
const mockMontarChaveResultado = jest.fn();

jest.unstable_mockModule('better-sqlite3', () => ({
  __esModule: true,
  default: mockDatabase,
}));

jest.unstable_mockModule('sqlite-vec', () => ({
  __esModule: true,
  load: mockSqliteVecLoad,
}));

// O caminho é resolvido a partir do jest.setup.ts (raiz do projeto), por isso
// `./src/...` em vez de um caminho relativo a este arquivo.
jest.unstable_mockModule('./src/searchBible.js', () => ({
  __esModule: true,
  serializarEmbeddingParaVec: mockSerializarEmbeddingParaVec,
  montarChaveResultado: mockMontarChaveResultado,
}));

const { buscarVetorial } = await import('./buscarVetorial.js');

// Aliases para manter o corpo dos testes inalterado
const Database = mockDatabase;
const sqliteVec = { load: mockSqliteVecLoad };
const serializarEmbeddingParaVec = mockSerializarEmbeddingParaVec;
const montarChaveResultado = mockMontarChaveResultado;

describe('buscarVetorial', () => {
  const caminhoDb = '/tmp/biblia.sqlite';
  const limite = 2;

  const mockPrepare = jest.fn();
  const mockClose = jest.fn();
  const mockAll = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrepare.mockReset();
    mockClose.mockReset();
    mockAll.mockReset();

    const mockBanco = {
      prepare: mockPrepare,
      close: mockClose,
    };

    (Database as unknown as jest.Mock).mockImplementation(() => mockBanco as any);

    (montarChaveResultado as unknown as jest.Mock).mockImplementation(
      ({ testamento, livro, numeroCapitulo, indiceChunk }) =>
        `${testamento}|${livro}|${numeroCapitulo}|${indiceChunk}`
    );
  });

  it('deve retornar vazio quando não houver consultas vetoriais', async () => {
    const modeloEmbedding = {
      embed: jest.fn(),
    } as unknown as EmbeddingModel;

    const resultado = await buscarVetorial(caminhoDb, [], modeloEmbedding, limite);

    expect(resultado).toEqual([]);
    expect(modeloEmbedding.embed).not.toHaveBeenCalled();
    expect(Database).not.toHaveBeenCalled();
    expect(sqliteVec.load).not.toHaveBeenCalled();
  });

  it('deve deduplicar por menor distância, ordenar por score e respeitar limite', async () => {
    const modeloEmbedding = {
      embed: jest.fn(),
    } as unknown as EmbeddingModel;

    (modeloEmbedding.embed as jest.Mock).mockResolvedValue([
      { embedding: [0.11, 0.22] },
      { embedding: [0.33, 0.44] },
    ]);

    const buffer1 = Buffer.from('vec-1');
    const buffer2 = Buffer.from('vec-2');

    (serializarEmbeddingParaVec as unknown as jest.Mock)
      .mockReturnValueOnce(buffer1)
      .mockReturnValueOnce(buffer2);

    mockPrepare.mockReturnValue({ all: mockAll });
    mockAll
      .mockReturnValueOnce([
        {
          distance: 0.4,
          numeroCapitulo: 3,
          livro: 'João',
          numeroLivro: 43,
          testamento: 'NT',
          texto: 'Texto A',
          indiceChunk: 1,
        },
        {
          distance: 0.8,
          numeroCapitulo: 1,
          livro: 'Gênesis',
          numeroLivro: 1,
          testamento: 'AT',
          texto: 'Texto B',
          indiceChunk: 2,
        },
      ])
      .mockReturnValueOnce([
        {
          distance: 0.2,
          numeroCapitulo: 3,
          livro: 'João',
          numeroLivro: 43,
          testamento: 'NT',
          texto: 'Texto A melhor',
          indiceChunk: 1,
        },
        {
          distance: 0.6,
          numeroCapitulo: 8,
          livro: 'Romanos',
          numeroLivro: 45,
          testamento: 'NT',
          texto: 'Texto C',
          indiceChunk: 3,
        },
      ]);

    const resultado = await buscarVetorial(
      caminhoDb,
      ['consulta 1', 'consulta 2'],
      modeloEmbedding,
      limite
    );

    expect(modeloEmbedding.embed).toHaveBeenCalledWith(['consulta 1', 'consulta 2']);
    expect(Database).toHaveBeenCalledWith(caminhoDb, { readonly: true });
    expect(sqliteVec.load).toHaveBeenCalledTimes(1);
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('FROM tabela_embedding_vec'));

    expect(serializarEmbeddingParaVec).toHaveBeenCalledTimes(2);
    expect(mockAll).toHaveBeenNthCalledWith(1, buffer1, limite);
    expect(mockAll).toHaveBeenNthCalledWith(2, buffer2, limite);

    expect(resultado).toHaveLength(2);

    expect(resultado[0]).toMatchObject({
      livro: 'João',
      numeroLivro: 43,
      numeroCapitulo: 3,
      testamento: 'NT',
      texto: 'Texto A melhor',
      indiceChunk: 1,
    });
    expect(resultado[0]!.scoreVetorial).toBeCloseTo(0.98, 6);

    expect(resultado[1]).toMatchObject({
      livro: 'Romanos',
      numeroLivro: 45,
      numeroCapitulo: 8,
      testamento: 'NT',
      texto: 'Texto C',
      indiceChunk: 3,
    });
    expect(resultado[1]!.scoreVetorial).toBeCloseTo(0.82, 6);

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('deve fechar conexão quando ocorrer erro na execução da busca knn', async () => {
    const modeloEmbedding = {
      embed: jest.fn(),
    } as unknown as EmbeddingModel;

    (modeloEmbedding.embed as jest.Mock).mockResolvedValue([
      { embedding: [0.1, 0.2] },
    ]);
    (serializarEmbeddingParaVec as unknown as jest.Mock).mockReturnValue(
      Buffer.from('vec')
    );

    mockPrepare.mockReturnValue({
      all: () => {
        throw new Error('falha no all knn');
      },
    });

    await expect(
      buscarVetorial(caminhoDb, ['consulta 1'], modeloEmbedding, limite)
    ).rejects.toThrow('falha no all knn');

    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
