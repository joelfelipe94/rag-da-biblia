import type { LMStudioClient } from '@lmstudio/sdk';
import { carregarSomenteModeloAlvo } from './carregarSomenteModeloAlvo.js';

describe('carregarSomenteModeloAlvo', () => {
  let mockCliente: jest.Mocked<LMStudioClient>;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    mockCliente = {
      llm: {
        listLoaded: jest.fn(),
        load: jest.fn(),
        unload: jest.fn(),
      },
    } as unknown as jest.Mocked<LMStudioClient>;

    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockRestore();
  });

  it('deve retornar o modelo se ele já estiver carregado', async () => {
    const modeloAlvo = 'mistral-7b';
    const modeloCarregado = {
      modelKey: modeloAlvo,
      identifier: 'model-123',
    } as any;

    (mockCliente.llm.listLoaded as jest.Mock).mockResolvedValue([
      modeloCarregado,
    ]);

    const resultado = await carregarSomenteModeloAlvo(
      mockCliente,
      modeloAlvo
    );

    expect(resultado).toEqual(modeloCarregado);
    expect(mockCliente.llm.listLoaded).toHaveBeenCalledTimes(1);
    expect(mockCliente.llm.load).not.toHaveBeenCalled();
    expect(mockCliente.llm.unload).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Modelo alvo já está carregado.'
    );
  });

  it('deve descarregar outros modelos e carregar o modelo alvo', async () => {
    const modeloAlvo = 'mistral-7b';
    const modelosCarregados = [
      { modelKey: 'outras-model-1', identifier: 'model-1' },
      { modelKey: 'outras-model-2', identifier: 'model-2' },
    ] as any;
    const novoModelo = { modelKey: modeloAlvo, identifier: 'model-novo' } as any;

    (mockCliente.llm.listLoaded as jest.Mock).mockResolvedValue(
      modelosCarregados
    );
    (mockCliente.llm.load as jest.Mock).mockResolvedValue(novoModelo);

    const resultado = await carregarSomenteModeloAlvo(
      mockCliente,
      modeloAlvo
    );

    expect(mockCliente.llm.unload).toHaveBeenCalledTimes(2);
    expect(mockCliente.llm.unload).toHaveBeenCalledWith('model-1');
    expect(mockCliente.llm.unload).toHaveBeenCalledWith('model-2');
    expect(mockCliente.llm.load).toHaveBeenCalledWith(modeloAlvo);
    expect(resultado).toEqual(novoModelo);
    expect(consoleSpy).toHaveBeenCalledWith('Descarregando modelos não utilizados.');
    expect(consoleSpy).toHaveBeenCalledWith('Carregando modelo alvo.');
  });

  it('deve carregar o modelo alvo se nenhum modelo estiver carregado', async () => {
    const modeloAlvo = 'mistral-7b';
    const novoModelo = { modelKey: modeloAlvo, identifier: 'model-novo' } as any;

    (mockCliente.llm.listLoaded as jest.Mock).mockResolvedValue([]);
    (mockCliente.llm.load as jest.Mock).mockResolvedValue(novoModelo);

    const resultado = await carregarSomenteModeloAlvo(
      mockCliente,
      modeloAlvo
    );

    expect(mockCliente.llm.unload).not.toHaveBeenCalled();
    expect(mockCliente.llm.load).toHaveBeenCalledWith(modeloAlvo);
    expect(resultado).toEqual(novoModelo);
    expect(consoleSpy).toHaveBeenCalledWith('Carregando modelo alvo.');
  });

  it('deve descarregar outros modelos mas não o modelo alvo', async () => {
    const modeloAlvo = 'mistral-7b';
    const modeloAlvoCarregado = { modelKey: modeloAlvo, identifier: 'model-alvo' };
    const outroModelo = { modelKey: 'outro', identifier: 'model-outro' };

    const modelosCarregados = [modeloAlvoCarregado, outroModelo] as any;

    (mockCliente.llm.listLoaded as jest.Mock).mockResolvedValue(
      modelosCarregados
    );

    const resultado = await carregarSomenteModeloAlvo(
      mockCliente,
      modeloAlvo
    );

    expect(mockCliente.llm.unload).toHaveBeenCalledTimes(1);
    expect(mockCliente.llm.unload).toHaveBeenCalledWith('model-outro');
    expect(mockCliente.llm.load).not.toHaveBeenCalled();
    expect(resultado).toEqual(modeloAlvoCarregado);
    expect(consoleSpy).toHaveBeenCalledWith('Descarregando modelos não utilizados.');
    expect(consoleSpy).toHaveBeenCalledWith('Modelo alvo já está carregado.');
  });

  it('deve propagar erros que aconteçam ao descarregar modelos', async () => {
    const modeloAlvo = 'mistral-7b';
    const outroModelo = { modelKey: 'outro', identifier: 'model-outro' };
    const erro = new Error('Erro ao descarregar modelo');

    (mockCliente.llm.listLoaded as jest.Mock).mockResolvedValue([outroModelo]);
    (mockCliente.llm.unload as jest.Mock).mockRejectedValue(erro);

    await expect(
      carregarSomenteModeloAlvo(mockCliente, modeloAlvo)
    ).rejects.toThrow('Erro ao descarregar modelo');
    expect(mockCliente.llm.unload).toHaveBeenCalledWith('model-outro');
  });

  it('deve propagar erros que aconteçam ao carregar o modelo alvo', async () => {
    const modeloAlvo = 'mistral-7b';
    const erro = new Error('Erro ao carregar modelo');

    (mockCliente.llm.listLoaded as jest.Mock).mockResolvedValue([]);
    (mockCliente.llm.load as jest.Mock).mockRejectedValue(erro);

    await expect(
      carregarSomenteModeloAlvo(mockCliente, modeloAlvo)
    ).rejects.toThrow('Erro ao carregar modelo');
    expect(mockCliente.llm.load).toHaveBeenCalledWith(modeloAlvo);
  });
});
