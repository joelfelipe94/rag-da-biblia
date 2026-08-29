import type { LMStudioClient } from '@lmstudio/sdk';
import { carregarSomenteModeloAlvoEmbedding } from './carregarSomenteModeloAlvoEmbedding.js';

describe('carregarSomenteModeloAlvoEmbedding', () => {
  let mockCliente: jest.Mocked<LMStudioClient>;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    mockCliente = {
      embedding: {
        listLoaded: jest.fn(),
        load: jest.fn(),
        unload: jest.fn(),
      },
    } as unknown as jest.Mocked<LMStudioClient>;

    // Spy no console.log
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleSpy.mockRestore();
  });

  it('deve retornar o modelo de embedding se ele já estiver carregado', async () => {
    const modeloEmbeddingAlvo = 'text-embedding-multilingual-e5-large';
    const modeloCarregado = {
      modelKey: modeloEmbeddingAlvo,
      identifier: 'embedding-123',
    } as any;

    (mockCliente.embedding.listLoaded as jest.Mock).mockResolvedValue([
      modeloCarregado,
    ]);

    const resultado = await carregarSomenteModeloAlvoEmbedding(
      mockCliente,
      modeloEmbeddingAlvo
    );

    expect(resultado).toEqual(modeloCarregado);
    expect(mockCliente.embedding.listLoaded).toHaveBeenCalledTimes(1);
    expect(mockCliente.embedding.load).not.toHaveBeenCalled();
    expect(mockCliente.embedding.unload).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Modelo de embedding alvo já está carregado.'
    );
  });

  it('deve descarregar outros modelos de embedding e carregar o modelo alvo', async () => {
    const modeloEmbeddingAlvo = 'text-embedding-multilingual-e5-large';
    const modelosCarregados = [
      { modelKey: 'outro-embedding-1', identifier: 'embedding-1' },
      { modelKey: 'outro-embedding-2', identifier: 'embedding-2' },
    ] as any;
    const novoModelo = {
      modelKey: modeloEmbeddingAlvo,
      identifier: 'embedding-novo',
    } as any;

    (mockCliente.embedding.listLoaded as jest.Mock).mockResolvedValue(
      modelosCarregados
    );
    (mockCliente.embedding.load as jest.Mock).mockResolvedValue(novoModelo);

    const resultado = await carregarSomenteModeloAlvoEmbedding(
      mockCliente,
      modeloEmbeddingAlvo
    );

    expect(mockCliente.embedding.unload).toHaveBeenCalledTimes(2);
    expect(mockCliente.embedding.unload).toHaveBeenCalledWith('embedding-1');
    expect(mockCliente.embedding.unload).toHaveBeenCalledWith('embedding-2');
    expect(mockCliente.embedding.load).toHaveBeenCalledWith(modeloEmbeddingAlvo);
    expect(resultado).toEqual(novoModelo);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Descarregando modelos de embedding não utilizados.'
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      'Carregando modelo de embedding alvo.'
    );
  });

  it('deve carregar o modelo de embedding se nenhum modelo estiver carregado', async () => {
    const modeloEmbeddingAlvo = 'text-embedding-multilingual-e5-large';
    const novoModelo = {
      modelKey: modeloEmbeddingAlvo,
      identifier: 'embedding-novo',
    } as any;

    (mockCliente.embedding.listLoaded as jest.Mock).mockResolvedValue([]);
    (mockCliente.embedding.load as jest.Mock).mockResolvedValue(novoModelo);

    const resultado = await carregarSomenteModeloAlvoEmbedding(
      mockCliente,
      modeloEmbeddingAlvo
    );

    expect(mockCliente.embedding.unload).not.toHaveBeenCalled();
    expect(mockCliente.embedding.load).toHaveBeenCalledWith(modeloEmbeddingAlvo);
    expect(resultado).toEqual(novoModelo);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Carregando modelo de embedding alvo.'
    );
  });

  it('deve descarregar outros modelos mas não o modelo de embedding alvo', async () => {
    const modeloEmbeddingAlvo = 'text-embedding-multilingual-e5-large';
    const modeloAlvoCarregado = {
      modelKey: modeloEmbeddingAlvo,
      identifier: 'embedding-alvo',
    };
    const outroModelo = { modelKey: 'outro', identifier: 'embedding-outro' };

    const modelosCarregados = [modeloAlvoCarregado, outroModelo] as any;

    (mockCliente.embedding.listLoaded as jest.Mock).mockResolvedValue(
      modelosCarregados
    );

    const resultado = await carregarSomenteModeloAlvoEmbedding(
      mockCliente,
      modeloEmbeddingAlvo
    );

    expect(mockCliente.embedding.unload).toHaveBeenCalledTimes(1);
    expect(mockCliente.embedding.unload).toHaveBeenCalledWith('embedding-outro');
    expect(mockCliente.embedding.load).not.toHaveBeenCalled();
    expect(resultado).toEqual(modeloAlvoCarregado);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Descarregando modelos de embedding não utilizados.'
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      'Modelo de embedding alvo já está carregado.'
    );
  });

  it('deve lidar com erros ao descarregar modelos de embedding', async () => {
    const modeloEmbeddingAlvo = 'text-embedding-multilingual-e5-large';
    const outroModelo = { modelKey: 'outro', identifier: 'embedding-outro' };
    const erro = new Error('Erro ao descarregar modelo de embedding');

    (mockCliente.embedding.listLoaded as jest.Mock).mockResolvedValue([
      outroModelo,
    ]);
    (mockCliente.embedding.unload as jest.Mock).mockRejectedValue(erro);

    await expect(
      carregarSomenteModeloAlvoEmbedding(
        mockCliente,
        modeloEmbeddingAlvo
      )
    ).rejects.toThrow('Erro ao descarregar modelo de embedding');
    expect(mockCliente.embedding.unload).toHaveBeenCalledWith(
      'embedding-outro'
    );
  });

  it('deve lidar com erros ao carregar o modelo de embedding alvo', async () => {
    const modeloEmbeddingAlvo = 'text-embedding-multilingual-e5-large';
    const erro = new Error('Erro ao carregar modelo de embedding');

    (mockCliente.embedding.listLoaded as jest.Mock).mockResolvedValue([]);
    (mockCliente.embedding.load as jest.Mock).mockRejectedValue(erro);

    await expect(
      carregarSomenteModeloAlvoEmbedding(
        mockCliente,
        modeloEmbeddingAlvo
      )
    ).rejects.toThrow('Erro ao carregar modelo de embedding');
    expect(mockCliente.embedding.load).toHaveBeenCalledWith(
      modeloEmbeddingAlvo
    );
  });
});
