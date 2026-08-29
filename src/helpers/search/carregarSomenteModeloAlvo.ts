import type { LMStudioClient, LLM } from '@lmstudio/sdk';

/**
 * Carrega exclusivamente o modelo alvo, descarregando todos os outros modelos.
 * 
 * Esta função gerencia o carregamento de modelos LM Studio, garantindo que apenas
 * o modelo especificado esteja ativo. Se o modelo alvo já estiver carregado, a função
 * o retorna diretamente. Caso contrário, descarrega todos os outros modelos e carrega
 * o modelo alvo.
 * 
 * @param cliente - Cliente LM Studio para interagir com os modelos
 * @param modeloAlvo - A chave/identificador do modelo a ser carregado
 * 
 * @returns Promise que se resolve com o modelo LLM carregado
 * 
 * @example
 * ```typescript
 * const cliente = new LMStudioClient();
 * const modelo = await carregarSomenteModeloAlvo(cliente, 'google/gemma-4-12b-qat');
 * ```
 * 
 * @remarks
 * - Descarrega automaticamente modelos não utilizados para liberar recursos
 * - Se o modelo alvo já está carregado, apenas o retorna sem operações adicionais
 * - Imprime logs no console durante o processo de carregamento/descarregamento
 */
export async function carregarSomenteModeloAlvo(
  cliente: LMStudioClient,
  modeloAlvo: string): Promise<LLM> {
  const modelosCarregados = await cliente.llm.listLoaded();

  const modelosParaDescarregar = modelosCarregados.filter(
    (modeloCarregado) => modeloCarregado.modelKey !== modeloAlvo
  );
  if (modelosParaDescarregar.length > 0) {
    console.log('Descarregando modelos não utilizados.');
    for (const modeloCarregado of modelosParaDescarregar) {
      await cliente.llm.unload(modeloCarregado.identifier);
    }
  }
  const modeloCarregado = modelosCarregados.find(
    (modeloCarregado) => modeloCarregado.modelKey === modeloAlvo
  );
  if (modeloCarregado) {
    console.log('Modelo alvo já está carregado.');
    return modeloCarregado;
  }

  console.log('Carregando modelo alvo.');
  return cliente.llm.load(modeloAlvo);;
}
