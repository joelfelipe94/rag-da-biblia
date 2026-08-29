import type { LMStudioClient, EmbeddingModel } from '@lmstudio/sdk';

/**
 * Carrega exclusivamente o modelo de embedding alvo, descarregando todos os outros modelos de embedding.
 * 
 * Esta função gerencia o carregamento de modelos de embedding no LM Studio, garantindo que apenas
 * o modelo especificado esteja ativo. Se o modelo alvo já estiver carregado, a função
 * o retorna diretamente. Caso contrário, descarrega todos os outros modelos de embedding e carrega
 * o modelo alvo.
 * 
 * @param cliente - Cliente LM Studio para interagir com os modelos
 * @param modeloEmbeddingAlvo - A chave/identificador do modelo de embedding a ser carregado
 * 
 * @returns Promise que se resolve com o modelo de embedding carregado
 * 
 * @example
 * ```typescript
 * const cliente = new LMStudioClient();
 * const modelo = await carregarSomenteModeloAlvoEmbedding(
 *   cliente,
 *  'text-embedding-multilingual-e5-large'
 * );
 * ```
 * 
 * @remarks
 * - Descarrega automaticamente modelos de embedding não utilizados para liberar recursos
 * - Se o modelo alvo já está carregado, apenas o retorna sem operações adicionais
 * - Imprime logs no console durante o processo de carregamento/descarregamento
 */
export async function carregarSomenteModeloAlvoEmbedding(
  cliente: LMStudioClient,
  modeloEmbeddingAlvo: string,
): Promise<EmbeddingModel> {
  const modelosCarregados = await cliente.embedding.listLoaded();

  const modelosParaDescarregar = modelosCarregados.filter(
    (modeloCarregado) => modeloCarregado.modelKey !== modeloEmbeddingAlvo
  );
  if (modelosParaDescarregar.length > 0) {
    console.log('Descarregando modelos de embedding não utilizados.');
    for (const modeloCarregado of modelosParaDescarregar) {
      await cliente.embedding.unload(modeloCarregado.identifier);
    }
  }

  const modeloCarregado = modelosCarregados.find(
    (modeloCarregado) => modeloCarregado.modelKey === modeloEmbeddingAlvo
  );
  if (modeloCarregado) {
    console.log('Modelo de embedding alvo já está carregado.');
    return modeloCarregado;
  }

  console.log('Carregando modelo de embedding alvo.');
  return cliente.embedding.load(modeloEmbeddingAlvo);
}