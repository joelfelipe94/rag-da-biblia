import type { EmbeddingModel } from '@lmstudio/sdk';

const mockDatabase = jest.fn();
const mockSqliteVecLoad = jest.fn();
jest.unstable_mockModule('better-sqlite3', () => ({
  __esModule: true,
  default: mockDatabase,
}));

jest.unstable_mockModule('sqlite-vec', () => ({
  __esModule: true,
  load: mockSqliteVecLoad,
}));

const { buscarVetorial } = await import('./buscarVetorial.js');

// Aliases para manter o corpo dos testes inalterado
const Database = mockDatabase;
const sqliteVec = { load: mockSqliteVecLoad };

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
