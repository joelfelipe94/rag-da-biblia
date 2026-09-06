import { Chat, type LLM } from '@lmstudio/sdk';
import { produzirDocumentoHipoteticoParaBuscaEmbedding } from './produzirDocumentoHipoteticoParaBuscaEmbedding.js';
import { PROMPT_HYDE } from '../../systemPrompts.js';
import { OPCOES_SEM_RACIOCINIO } from '../modelos.js';

describe('produzirDocumentoHipoteticoParaBuscaEmbedding', () => {
  let mockModelo: LLM;
  let consoleSpy: jest.SpyInstance;
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    mockModelo = {
      respond: jest.fn(),
    } as unknown as LLM;

    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  it('deve chamar o modelo com chat e a config sem raciocínio', async () => {
    const consultaOriginal = 'Quem foi Noé na Bíblia?';
    const mockPredicao = {
      [Symbol.asyncIterator]: async function* () {
        yield { content: 'Noé foi um homem justo.' };
      },
      nonReasoningContent: 'Noé foi um homem justo.',
    };

    (mockModelo.respond as any).mockReturnValue(mockPredicao);

    const resultado = await produzirDocumentoHipoteticoParaBuscaEmbedding(
      mockModelo,
      consultaOriginal
    );

    expect(resultado).toBe('Noé foi um homem justo.');
    expect(mockModelo.respond).toHaveBeenCalledTimes(1);
    expect(mockModelo.respond).toHaveBeenCalledWith(
      expect.any(Chat),
      OPCOES_SEM_RACIOCINIO,
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      '\nGerando documento hipotético (HyDE) para busca por embedding:'
    );
    expect(PROMPT_HYDE).toBeDefined();
  });

  it('deve escrever os chunks recebidos no stdout e finalizar com quebra de linha', async () => {
    const mockPredicao = {
      [Symbol.asyncIterator]: async function* () {
        yield { content: 'parte 1 ' };
        yield { content: 'parte 2' };
      },
      nonReasoningContent: 'parte 1 parte 2',
    };

    (mockModelo.respond as any).mockReturnValue(mockPredicao);

    await produzirDocumentoHipoteticoParaBuscaEmbedding(
      mockModelo,
      'consulta qualquer'
    );

    expect(stdoutSpy).toHaveBeenCalledTimes(3);
    expect(stdoutSpy).toHaveBeenNthCalledWith(1, 'parte 1 ');
    expect(stdoutSpy).toHaveBeenNthCalledWith(2, 'parte 2');
    expect(stdoutSpy).toHaveBeenNthCalledWith(3, '\n');
  });

  it('deve remover espaços extras da resposta final', async () => {
    const mockPredicao = {
      [Symbol.asyncIterator]: async function* () {
        yield { content: '  texto com espacos  ' };
      },
      nonReasoningContent: '  texto com espacos  \n',
    };

    (mockModelo.respond as any).mockReturnValue(mockPredicao);

    const resultado = await produzirDocumentoHipoteticoParaBuscaEmbedding(
      mockModelo,
      'consulta de teste'
    );

    expect(resultado).toBe('texto com espacos');
  });
});
