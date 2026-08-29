import type { ResultadoFinal } from '../types.js';

const mockResumirTexto = jest.fn();

// O caminho é resolvido a partir do jest.setup.ts (raiz do projeto), por isso
// `./src/...` em vez de um caminho relativo a este arquivo.
jest.unstable_mockModule('./src/searchBible.js', () => ({
  __esModule: true,
  resumirTexto: mockResumirTexto,
}));

const { imprimirCapitulosEncontrados } = await import('./imprimirCapitulosEncontrados.js');
const resumirTexto = mockResumirTexto;

describe('imprimirCapitulosEncontrados', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('deve informar quando não houver resultados', () => {
    imprimirCapitulosEncontrados([]);

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      '\nNenhum resultado encontrado para a consulta informada.',
    );
    expect(resumirTexto).not.toHaveBeenCalled();
  });

  it('deve imprimir top resultados com scores e trecho resumido', () => {
    (resumirTexto as unknown as jest.Mock)
      .mockReturnValueOnce('resumo do trecho 1')
      .mockReturnValueOnce('resumo do trecho 2');

    const resultados: ResultadoFinal[] = [
      {
        indiceChunk: 10,
        livro: 'João',
        numeroLivro: 43,
        indiceCapitulo: 0,
        numeroCapitulo: 3,
        testamento: 'NT',
        texto: 'Porque Deus amou o mundo...',
        scoreFinal: 0.987654321,
        scoreFts: -3.456789,
        scoreVetorial: 0.876543,
      },
      {
        indiceChunk: 5,
        livro: 'Gênesis',
        numeroLivro: 1,
        indiceCapitulo: 0,
        numeroCapitulo: 1,
        testamento: 'AT',
        texto: 'No princípio criou Deus os céus e a terra...',
        scoreFinal: 0.1234567,
      },
    ];

    imprimirCapitulosEncontrados(resultados);

    expect(resumirTexto).toHaveBeenCalledTimes(2);
    expect(resumirTexto).toHaveBeenNthCalledWith(1, resultados[0]!.texto, 240);
    expect(resumirTexto).toHaveBeenNthCalledWith(2, resultados[1]!.texto, 240);

    expect(consoleSpy).toHaveBeenCalledWith('\nTop 2 resultados:');
    expect(consoleSpy).toHaveBeenCalledWith('\n1. NT - João 3');
    expect(consoleSpy).toHaveBeenCalledWith('   score_final=0.987654');
    expect(consoleSpy).toHaveBeenCalledWith('   score_fts=-3.456789');
    expect(consoleSpy).toHaveBeenCalledWith('   score_vetorial=0.876543');
    expect(consoleSpy).toHaveBeenCalledWith('   trecho=resumo do trecho 1');

    expect(consoleSpy).toHaveBeenCalledWith('\n2. AT - Gênesis 1');
    expect(consoleSpy).toHaveBeenCalledWith('   score_final=0.123457');
    expect(consoleSpy).toHaveBeenCalledWith('   trecho=resumo do trecho 2');
  });

  it('nao deve imprimir score_fts ou score_vetorial quando nao forem numeros', () => {
    (resumirTexto as unknown as jest.Mock).mockReturnValue('resumo');

    const resultados: ResultadoFinal[] = [
      {
        indiceChunk: 1,
        livro: 'Salmos',
        numeroLivro: 19,
        indiceCapitulo: 0,
        numeroCapitulo: 23,
        testamento: 'AT',
        texto: 'O Senhor e meu pastor...',
        scoreFinal: 0.5,
      },
    ];

    imprimirCapitulosEncontrados(resultados);

    expect(consoleSpy).toHaveBeenCalledWith('   score_final=0.500000');
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('score_fts='),
    );
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('score_vetorial='),
    );
  });
});
