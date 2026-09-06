import { Chat, type LLM } from '@lmstudio/sdk';
import { produzirParafraseParaBuscaEmbedding } from './produzirParafraseParaBuscaEmbedding.js';
import { OPCOES_SEM_RACIOCINIO } from '../modelos.js';

describe('produzirParafraseParaBuscaEmbedding', () => {
  let mockModelo: LLM;
  const consultaOriginal = 'O que Deus disse sobre o amor?';

  beforeEach(() => {
    jest.clearAllMocks();

    mockModelo = {
      respond: jest.fn(),
    } as unknown as LLM;
  });

  describe('Sucesso na primeira tentativa', () => {
    it('deve retornar um array de paráfrases válidas', async () => {
      const parafrases = ['Ensinamentos de Deus sobre amor', 'Amor segundo a Bíblia', 'Definição divina de amor'];
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: `${parafrases[0]}\n` };
          yield { content: `${parafrases[1]}\n` };
          yield { content: `${parafrases[2]}` };
        },
      };
      const mockResponse = {
        nonReasoningContent: parafrases.join('\n'),
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const resultado = await produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal);

      expect(resultado).toEqual(parafrases);
      expect(mockModelo.respond).toHaveBeenCalledTimes(1);
      expect(mockModelo.respond).toHaveBeenCalledWith(expect.any(Chat), OPCOES_SEM_RACIOCINIO);
    });

    it('deve retornar uma única paráfrase válida', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: 'paráfrase única' };
        },
      };
      const mockResponse = {
        nonReasoningContent: 'paráfrase única',
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const resultado = await produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal);

      expect(resultado).toEqual(['paráfrase única']);
    });

    it('deve retornar exatamente 3 paráfrases quando produzidas', async () => {
      const parafrases = ['paráfrase 1', 'paráfrase 2', 'paráfrase 3'];
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: parafrases.join('\n') };
        },
      };
      const mockResponse = {
        nonReasoningContent: parafrases.join('\n'),
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const resultado = await produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal);

      expect(resultado).toEqual(parafrases);
      expect(resultado.length).toBe(3);
    });

    it('deve remover espaços em branco das paráfrases', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: '  paráfrase com espaços  \n' };
          yield { content: '\t paráfrase 2 \t\n' };
          yield { content: '   paráfrase 3   ' };
        },
      };
      const mockResponse = {
        nonReasoningContent: '  paráfrase com espaços  \n\t paráfrase 2 \t\n   paráfrase 3   ',
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const resultado = await produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal);

      expect(resultado).toEqual(['paráfrase com espaços', 'paráfrase 2', 'paráfrase 3']);
    });

    it('deve filtrar linhas vazias', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: 'paráfrase 1\n' };
          yield { content: '\n' };
          yield { content: 'paráfrase 2\n' };
          yield { content: '   \n' };
          yield { content: 'paráfrase 3' };
        },
      };
      const mockResponse = {
        nonReasoningContent: 'paráfrase 1\n\nparáfrase 2\n   \nparáfrase 3',
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const resultado = await produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal);

      expect(resultado).toEqual(['paráfrase 1', 'paráfrase 2', 'paráfrase 3']);
    });
  });

  describe('Validação de tamanho de linha', () => {
    it('deve lançar erro quando linha excede 300 caracteres', async () => {
      const linhaGrande = 'a'.repeat(301);
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: linhaGrande };
        },
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);

      await expect(produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal)).rejects.toThrow(
        'O modelo não conseguiu produzir paráfrases válidas após 3 tentativas.'
      );
    });

    it('deve aceitar linha com exatamente 300 caracteres', async () => {
      const linhaExata = 'a'.repeat(300);
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: linhaExata };
        },
      };
      const mockResponse = {
        nonReasoningContent: linhaExata,
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const resultado = await produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal);

      expect(resultado).toEqual([linhaExata]);
    });

    it('deve detectar excesso de caracteres em uma linha', async () => {
      const linhaComMuitosCaracteres = 'paráfrase 1\n' + 'a'.repeat(301);
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: linhaComMuitosCaracteres };
        },
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);

      await expect(produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal)).rejects.toThrow(
        'O modelo não conseguiu produzir paráfrases válidas após 3 tentativas.'
      );
    });

    it('deve acumular tamanho de linha corretamente com múltiplos chunks', async () => {
      const linhaGrande = 'a'.repeat(301);
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: linhaGrande.substring(0, 200) };
          yield { content: linhaGrande.substring(200) };
        },
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);

      await expect(produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal)).rejects.toThrow(
        'O modelo não conseguiu produzir paráfrases válidas após 3 tentativas.'
      );
    });
  });

  describe('Validação de número de linhas', () => {
    it('deve lançar erro quando modelo produz mais de 3 linhas', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: 'paráfrase 1\n' };
          yield { content: 'paráfrase 2\n' };
          yield { content: 'paráfrase 3\n' };
          yield { content: 'paráfrase 4' };
        },
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);

      await expect(produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal)).rejects.toThrow(
        'O modelo não conseguiu produzir paráfrases válidas após 3 tentativas.'
      );
    });

    it('deve aceitar exatamente 3 linhas', async () => {
      const parafrases = ['paráfrase 1', 'paráfrase 2', 'paráfrase 3'];
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: 'paráfrase 1\nparáfrase 2\nparáfrase 3' };
        },
      };
      const mockResponse = {
        nonReasoningContent: 'paráfrase 1\nparáfrase 2\nparáfrase 3',
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const resultado = await produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal);

      expect(resultado).toEqual(parafrases);
      expect(resultado.length).toBe(3);
    });

    it('deve contar linhas não vazias corretamente', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: 'paráfrase 1\n' };
          yield { content: '\n' };
          yield { content: 'paráfrase 2\n' };
          yield { content: '\n' };
          yield { content: 'paráfrase 3' };
        },
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);

      // Should NOT throw during iteration since we're counting line breaks in streaming
      // The test verifies the filtering happens during final processing
      const mockResponse = {
        nonReasoningContent: 'paráfrase 1\n\nparáfrase 2\n\nparáfrase 3',
      };
      Object.assign(mockStream, mockResponse);

      const resultado = await produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal);

      expect(resultado).toEqual(['paráfrase 1', 'paráfrase 2', 'paráfrase 3']);
    });
  });

  describe('Validação de resposta vazia', () => {
    it('deve lançar erro quando nenhuma paráfrase é produzida', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: '\n\n\n' };
        },
      };
      const mockResponse = {
        nonReasoningContent: '\n\n\n',
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      await expect(produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal)).rejects.toThrow(
        'O modelo não conseguiu produzir paráfrases válidas após 3 tentativas.'
      );
    });

    it('deve lançar erro quando resposta contém apenas espaços em branco', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: '   \n\t\n   ' };
        },
      };
      const mockResponse = {
        nonReasoningContent: '   \n\t\n   ',
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      await expect(produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal)).rejects.toThrow(
        'O modelo não conseguiu produzir paráfrases válidas após 3 tentativas.'
      );
    });
  });

  describe('Lógica de retry', () => {
    it('deve falhar após múltiplas tentativas quando linha excede 300 caracteres', async () => {
      const linhaGrande = 'a'.repeat(301);
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: linhaGrande };
        },
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);

      await expect(produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal)).rejects.toThrow(
        'O modelo não conseguiu produzir paráfrases válidas após 3 tentativas.'
      );

      expect(mockModelo.respond).toHaveBeenCalledTimes(1);
    });

    it('deve tentar processar a resposta mesmo depois de erro na primeira iteração', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const linhaGrande = 'a'.repeat(301);
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: linhaGrande };
        },
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);

      try {
        await produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal);
      } catch (error) {
        // Expected to throw
      }

      // Should have warned twice (tentativa 1 and 2), not on 3rd
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao processar a resposta do modelo na tentativa'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    it('deve lançar erro após múltiplas tentativas de processamento falharem', async () => {
      const linhaGrande = 'a'.repeat(301);
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: linhaGrande };
        },
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);

      await expect(produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal)).rejects.toThrow(
        'O modelo não conseguiu produzir paráfrases válidas após 3 tentativas.'
      );
    });

    it('deve tentar até 3 vezes quando resposta vazia', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: '\n\n' };
        },
      };
      const mockResponse = {
        nonReasoningContent: '\n\n',
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      try {
        await produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal);
      } catch (error) {
        // Expected to throw
        expect(error).toEqual(
          new Error('O modelo não conseguiu produzir paráfrases válidas após 3 tentativas.')
        );
      }

      // Should have warned 2 times (tentativa 1 and 2, not on 3rd)
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
      consoleWarnSpy.mockRestore();
    });

    it('deve suprimir avisos nas tentativas 1 e 2, mas lançar erro na tentativa 3', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const linhaGrande = 'a'.repeat(301);
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: linhaGrande };
        },
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);

      try {
        await produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal);
      } catch {
        // Expected to throw
      }

      // Should have warned exactly twice (tentativa 1 and 2), not on the 3rd attempt
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('tentativa 1 de 3'),
        expect.any(Error)
      );
      expect(consoleWarnSpy).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('tentativa 2 de 3'),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Streaming e concatenação de conteúdo', () => {
    it('deve processar múltiplos chunks corretamente', async () => {
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: 'paráfrase ' };
          yield { content: '1\n' };
          yield { content: 'paráfrase ' };
          yield { content: '2' };
        },
      };
      const mockResponse = {
        nonReasoningContent: 'paráfrase 1\nparáfrase 2',
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const resultado = await produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal);

      expect(resultado).toEqual(['paráfrase 1', 'paráfrase 2']);
    });

    it('deve escrever conteúdo para stdout durante streaming', async () => {
      const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true as any);
      const conteudoEsperado = ['conteúdo1', 'conteúdo2', 'conteúdo3'];

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: conteudoEsperado[0] };
          yield { content: conteudoEsperado[1] };
          yield { content: conteudoEsperado[2] };
        },
      };
      const mockResponse = {
        nonReasoningContent: conteudoEsperado.join(''),
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      await produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal);

      expect(stdoutSpy).toHaveBeenCalledWith('conteúdo1');
      expect(stdoutSpy).toHaveBeenCalledWith('conteúdo2');
      expect(stdoutSpy).toHaveBeenCalledWith('conteúdo3');

      stdoutSpy.mockRestore();
    });
  });

  describe('Edge cases', () => {
    it('deve tratar consulta original com caracteres especiais', async () => {
      const consultaEspecial = 'O que Deus disse sobre "amor" e (fé)?';
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: 'paráfrase' };
        },
      };
      const mockResponse = {
        nonReasoningContent: 'paráfrase',
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      await produzirParafraseParaBuscaEmbedding(mockModelo, consultaEspecial);

      expect(mockModelo.respond).toHaveBeenCalled();
    });

    it('deve aceitar paráfrases com caracteres acentuados', async () => {
      const parafrases = ['Ênfase no amor divino', 'Definição de fé cristã', 'Significado profundo'];
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: parafrases.join('\n') };
        },
      };
      const mockResponse = {
        nonReasoningContent: parafrases.join('\n'),
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const resultado = await produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal);

      expect(resultado).toEqual(parafrases);
    });

    it('deve lidar com paráfrases contendo números e símbolos', async () => {
      const parafrases = ['Amor em 1 João 4:7-8', 'Definição (teológica)', 'Significado: amor divino'];
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: parafrases.join('\n') };
        },
      };
      const mockResponse = {
        nonReasoningContent: parafrases.join('\n'),
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const resultado = await produzirParafraseParaBuscaEmbedding(mockModelo, consultaOriginal);

      expect(resultado).toEqual(parafrases);
    });
  });
});
