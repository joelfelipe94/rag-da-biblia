import { Chat, type LLM } from '@lmstudio/sdk';

const mockPrepare = jest.fn();
const mockAll = jest.fn();

// Mock do módulo better-sqlite3 (API de ESM: registra antes do import dinâmico)
const mockDatabase = jest.fn();
jest.unstable_mockModule('better-sqlite3', () => ({
  __esModule: true,
  default: mockDatabase,
}));

const { produzirConsultaParaFTS } = await import('./produzirConsultaParaFTS.js');
// Alias para manter o corpo dos testes inalterado
const Database = mockDatabase;

describe('produzirConsultaParaFTS', () => {
  let mockModelo: LLM;
  const caminhoDb = '/test/db.sqlite';

  beforeEach(() => {
    jest.clearAllMocks();

    jest.mocked(Database).mockImplementation((_filename, _options) => {
      return {
        prepare: mockPrepare,
        all: mockAll,
        close: jest.fn(),
      };
    });

    // Setup mock model
    mockModelo = {
      respond: jest.fn(),
    } as unknown as LLM;
  });

  describe('Sucesso na primeira tentativa', () => {
    it('deve retornar uma consulta FTS válida gerada pelo modelo', async () => {
      const consultaEsperada = 'test OR query';
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: 'test' };
          yield { content: ' OR ' };
          yield { content: 'query' };
        },
      };
      const mockResponse = {
        nonReasoningContent: consultaEsperada,
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      // Mock database validation - válida

      mockPrepare.mockReturnValue({
        all: jest.fn().mockReturnValue([]),
      });
      const resultado = await produzirConsultaParaFTS(
        mockModelo,
        'test query',
        caminhoDb,
      );

      expect(resultado).toBe(consultaEsperada);
      expect(mockModelo.respond).toHaveBeenCalledTimes(1);
      expect(mockModelo.respond).toHaveBeenCalledWith(expect.any(Chat), {
        preset: 'no-thinking',
      });
    });

    it('deve podar a resposta do modelo', async () => {
      const consultaComEspacos = '  test OR query  \n';
      const consultaEsperada = 'test OR query';
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: consultaComEspacos };
        },
      };
      const mockResponse = {
        nonReasoningContent: consultaComEspacos,
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const mockDb = Database as any;
      const mockPrepare = jest.fn().mockReturnValue({
        all: jest.fn().mockReturnValue([]),
      });
      mockDb.mockReturnValue({
        prepare: mockPrepare,
        close: jest.fn(),
      });

      const resultado = await produzirConsultaParaFTS(
        mockModelo,
        'test query',
        caminhoDb,
      );

      expect(resultado).toBe(consultaEsperada);
    });
  });

  describe('Limite de tamanho (300 caracteres)', () => {
    it('deve descartar resposta que excede 300 caracteres e tentar novamente', async () => {
      const consultaGrande = 'x'.repeat(301);
      const consultaValida = 'valid query';

      const mockStream1 = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: consultaGrande };
        },
      };
      const mockResponse1 = {
        nonReasoningContent: consultaGrande,
      };

      const mockStream2 = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: consultaValida };
        },
      };
      const mockResponse2 = {
        nonReasoningContent: consultaValida,
      };

      (mockModelo.respond as any)
        .mockReturnValueOnce(mockStream1)
        .mockReturnValueOnce(mockStream2);
      Object.assign(mockStream1, mockResponse1);
      Object.assign(mockStream2, mockResponse2);

      const mockDb = Database as any;
      const mockPrepare = jest.fn().mockReturnValue({
        all: jest.fn().mockReturnValue([]),
      });
      mockDb.mockReturnValue({
        prepare: mockPrepare,
        close: jest.fn(),
      });

      const resultado = await produzirConsultaParaFTS(
        mockModelo,
        'test query',
        caminhoDb,
      );

      expect(resultado).toBe(consultaValida);
      expect(mockModelo.respond).toHaveBeenCalledTimes(2);
    });

    it('deve contar bytes corretamente no streaming da resposta', async () => {
      const chunks = ['abc', 'def', 'ghi']; // 3 bytes cada = 9 bytes total
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) {
            yield { content: chunk };
          }
        },
      };
      const mockResponse = {
        nonReasoningContent: chunks.join(''),
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const mockDb = Database as any;
      const mockPrepare = jest.fn().mockReturnValue({
        all: jest.fn().mockReturnValue([]),
      });
      mockDb.mockReturnValue({
        prepare: mockPrepare,
        close: jest.fn(),
      });

      const resultado = await produzirConsultaParaFTS(
        mockModelo,
        'test query',
        caminhoDb,
      );

      expect(resultado).toBe(chunks.join(''));
    });
  });

  describe('Validação de consulta', () => {
    it('deve aceitar consulta válida no SQL', async () => {
      const consultaValida = 'teste AND busca';
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: consultaValida };
        },
      };
      const mockResponse = {
        nonReasoningContent: consultaValida,
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const mockDb = Database as any;
      const mockPrepare = jest.fn().mockReturnValue({
        all: jest.fn().mockReturnValue([]),
      });
      mockDb.mockReturnValue({
        prepare: mockPrepare,
        close: jest.fn(),
      });

      const resultado = await produzirConsultaParaFTS(
        mockModelo,
        'test query',
        caminhoDb,
      );

      expect(resultado).toBe(consultaValida);
      const mockPrepareFunc = mockDb().prepare;
      expect(mockPrepareFunc).toHaveBeenCalled();
    });

    it('deve rejeitar consulta inválida e tentar novamente', async () => {
      const consultaInvalida = 'INVALID SQL;';
      const consultaValida = 'valid query';

      const mockStream1 = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: consultaInvalida };
        },
      };
      const mockResponse1 = {
        nonReasoningContent: consultaInvalida,
      };

      const mockStream2 = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: consultaValida };
        },
      };
      const mockResponse2 = {
        nonReasoningContent: consultaValida,
      };

      (mockModelo.respond as any)
        .mockReturnValueOnce(mockStream1)
        .mockReturnValueOnce(mockStream2);
      Object.assign(mockStream1, mockResponse1);
      Object.assign(mockStream2, mockResponse2);

      const mockDb = Database as any;
      const mockPrepare = jest
        .fn()
        .mockReturnValueOnce({
          all: jest.fn().mockImplementation(() => {
            throw new Error('SQL error');
          }),
        })
        .mockReturnValueOnce({
          all: jest.fn().mockReturnValue([]),
        });

      mockDb.mockReturnValue({
        prepare: mockPrepare,
        close: jest.fn(),
      });

      const resultado = await produzirConsultaParaFTS(
        mockModelo,
        'test query',
        caminhoDb,
      );

      expect(resultado).toBe(consultaValida);
      expect(mockModelo.respond).toHaveBeenCalledTimes(2);
    });
  });

  describe('Limite de tentativas', () => {
    it('deve lançar erro após 3 tentativas fracassadas', async () => {
      const consultaInvalida = 'INVALID;';

      for (let i = 0; i < 3; i++) {
        const mockStream = {
          [Symbol.asyncIterator]: async function* () {
            yield { content: consultaInvalida };
          },
        };
        const mockResponse = {
          nonReasoningContent: consultaInvalida,
        };

        (mockModelo.respond as any).mockReturnValue(mockStream);
        Object.assign(mockStream, mockResponse);
      }

      const mockDb = Database as any;
      const mockPrepare = jest.fn().mockReturnValue({
        all: jest.fn().mockImplementation(() => {
          throw new Error('SQL error');
        }),
      });
      mockDb.mockReturnValue({
        prepare: mockPrepare,
        close: jest.fn(),
      });

      await expect(
        produzirConsultaParaFTS(mockModelo, 'test query', caminhoDb),
      ).rejects.toThrow(
        'O modelo não conseguiu gerar uma consulta FTS válida após 3 tentativas.',
      );

      expect(mockModelo.respond).toHaveBeenCalledTimes(3);
    });

    it('deve descartar tentativas que excedem 300 caracteres', async () => {
      const consultaGrande = 'x'.repeat(301);
      const consultaValida = 'valid query';

      const mockStream1 = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: consultaGrande };
        },
      };
      const mockResponse1 = {
        nonReasoningContent: consultaGrande,
      };

      const mockStream2 = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: consultaGrande };
        },
      };
      const mockResponse2 = {
        nonReasoningContent: consultaGrande,
      };

      const mockStream3 = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: consultaValida };
        },
      };
      const mockResponse3 = {
        nonReasoningContent: consultaValida,
      };

      (mockModelo.respond as any)
        .mockReturnValueOnce(mockStream1)
        .mockReturnValueOnce(mockStream2)
        .mockReturnValueOnce(mockStream3);
      Object.assign(mockStream1, mockResponse1);
      Object.assign(mockStream2, mockResponse2);
      Object.assign(mockStream3, mockResponse3);

      const mockDb = Database as any;
      const mockPrepare = jest.fn().mockReturnValue({
        all: jest.fn().mockReturnValue([]),
      });
      mockDb.mockReturnValue({
        prepare: mockPrepare,
        close: jest.fn(),
      });

      const resultado = await produzirConsultaParaFTS(
        mockModelo,
        'test query',
        caminhoDb,
      );

      expect(resultado).toBe(consultaValida);
      expect(mockModelo.respond).toHaveBeenCalledTimes(3);
    });
  });

  describe('Gerenciamento de banco de dados', () => {
    it('deve fechar o banco de dados após validação', async () => {
      const consultaValida = 'valid query';

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: consultaValida };
        },
      };
      const mockResponse = {
        nonReasoningContent: consultaValida,
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const mockClose = jest.fn();
      const mockDb = Database as any;
      const mockPrepare = jest.fn().mockReturnValue({
        all: jest.fn().mockReturnValue([]),
      });
      mockDb.mockReturnValue({
        prepare: mockPrepare,
        close: mockClose,
      });

      await produzirConsultaParaFTS(mockModelo, 'test query', caminhoDb);

      expect(mockClose).toHaveBeenCalled();
    });

    it('deve abrir banco com readonly=true para validação', async () => {
      const consultaValida = 'valid query';

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: consultaValida };
        },
      };
      const mockResponse = {
        nonReasoningContent: consultaValida,
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const mockDb = Database as any;
      const mockPrepare = jest.fn().mockReturnValue({
        all: jest.fn().mockReturnValue([]),
      });
      mockDb.mockReturnValue({
        prepare: mockPrepare,
        close: jest.fn(),
      });

      await produzirConsultaParaFTS(mockModelo, 'test query', caminhoDb);

      expect(mockDb).toHaveBeenCalledWith(caminhoDb, { readonly: true });
    });
  });

  describe('Casos extremos', () => {
    it('deve lidar com consulta vazia retornada pelo modelo', async () => {
      const consultaVazia = '';

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: consultaVazia };
        },
      };
      const mockResponse = {
        nonReasoningContent: consultaVazia,
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const mockDb = Database as any;
      const mockPrepare = jest.fn().mockReturnValue({
        all: jest.fn().mockImplementation(() => {
          throw new Error('SQL error');
        }),
      });
      mockDb.mockReturnValue({
        prepare: mockPrepare,
        close: jest.fn(),
      });

      // Espera falha após 3 tentativas
      await expect(
        produzirConsultaParaFTS(mockModelo, 'test query', caminhoDb),
      ).rejects.toThrow();
    });

    it('deve lidar com stream com múltiplos chunks pequenos', async () => {
      const chunks = ['a', 'b', 'c', 'd', 'e'];
      const consultaEsperada = chunks.join('');

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) {
            yield { content: chunk };
          }
        },
      };
      const mockResponse = {
        nonReasoningContent: consultaEsperada,
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const mockDb = Database as any;
      const mockPrepare = jest.fn().mockReturnValue({
        all: jest.fn().mockReturnValue([]),
      });
      mockDb.mockReturnValue({
        prepare: mockPrepare,
        close: jest.fn(),
      });

      const resultado = await produzirConsultaParaFTS(
        mockModelo,
        'test query',
        caminhoDb,
      );

      expect(resultado).toBe(consultaEsperada);
    });

    it('deve aceitar consulta com exatamente 300 caracteres', async () => {
      const consulta300chars = 'x'.repeat(300);

      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield { content: consulta300chars };
        },
      };
      const mockResponse = {
        nonReasoningContent: consulta300chars,
      };

      (mockModelo.respond as any).mockReturnValue(mockStream);
      Object.assign(mockStream, mockResponse);

      const mockDb = Database as any;
      const mockPrepare = jest.fn().mockReturnValue({
        all: jest.fn().mockReturnValue([]),
      });
      mockDb.mockReturnValue({
        prepare: mockPrepare,
        close: jest.fn(),
      });

      const resultado = await produzirConsultaParaFTS(
        mockModelo,
        'test query',
        caminhoDb,
      );

      expect(resultado).toBe(consulta300chars);
    });
  });
});
