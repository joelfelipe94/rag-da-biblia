import type { ResultadoFts } from '../../types.js';

const mockDatabase = jest.fn();

jest.unstable_mockModule('better-sqlite3', () => ({
  __esModule: true,
  default: mockDatabase,
}));

const { buscarFts } = await import('./buscarFts.js');

describe('buscarFts', () => {
  const caminhoDb = '/tmp/biblia.sqlite';
  const consultaLexica = 'amor OR caridade';
  const limite = 5;

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

    mockDatabase.mockImplementation(() => mockBanco as any);
  });

  it('deve abrir o banco em readonly, executar a query FTS e retornar os resultados', () => {
    const resultadosEsperados: ResultadoFts[] = [
      {
        livro: 'João',
        numeroCapitulo: 3,
        numeroLivro: 43,
        testamento: 'NT',
        indiceChunk: 12,
        texto: 'Porque Deus amou o mundo...',
        scoreFts: -8.12,
      },
    ];

    mockPrepare.mockReturnValue({ all: mockAll });
    mockAll.mockReturnValue(resultadosEsperados);

    const resultado = buscarFts(caminhoDb, consultaLexica, limite);

    expect(mockDatabase).toHaveBeenCalledWith(caminhoDb, { readonly: true });
    expect(mockPrepare).toHaveBeenCalledTimes(1);
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('FROM tabela_fts'));
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('WHERE tabela_fts MATCH ?'));
    expect(mockAll).toHaveBeenCalledWith(consultaLexica, limite);
    expect(resultado).toEqual(resultadosEsperados);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('deve fechar a conexão quando ocorrer erro em prepare', () => {
    const erro = new Error('falha ao preparar consulta');
    mockPrepare.mockImplementation(() => {
      throw erro;
    });

    expect(() => buscarFts(caminhoDb, consultaLexica, limite)).toThrow(
      'falha ao preparar consulta'
    );
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('deve fechar a conexão quando ocorrer erro em all', () => {
    const erro = new Error('falha ao executar all');
    mockPrepare.mockReturnValue({
      all: () => {
        throw erro;
      },
    });

    expect(() => buscarFts(caminhoDb, consultaLexica, limite)).toThrow(
      'falha ao executar all'
    );
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
