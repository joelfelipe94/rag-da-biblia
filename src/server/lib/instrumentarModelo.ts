import type { LLM } from '@lmstudio/sdk';

type AoReceberFragmento = (texto: string) => void;

/**
 * Envolve um modelo LM Studio em um `Proxy` que "escuta" cada fragmento de texto
 * gerado por `modelo.respond(...)`, sem alterar o comportamento do modelo nem o
 * código dos helpers que o consomem.
 *
 * Os helpers de expansão de consulta (`produzirConsultaParaFTS`,
 * `produzirParafraseParaBuscaEmbedding`, `produzirDocumentoHipoteticoParaBuscaEmbedding`)
 * recebem um `LLM` e fazem `for await (const { content } of modelo.respond(...))`.
 * Passando o modelo instrumentado no lugar do original, conseguimos transmitir
 * esses mesmos tokens em tempo real para o cliente via SSE.
 *
 * @param modelo Modelo LLM real já carregado.
 * @param aoReceberFragmento Callback chamado com cada pedaço de texto gerado.
 * @returns Um `LLM` que se comporta como o original, porém notifica os fragmentos.
 */
export function instrumentarModelo(
  modelo: LLM,
  aoReceberFragmento: AoReceberFragmento,
): LLM {
  return new Proxy(modelo, {
    get(alvo, propriedade) {
      if (propriedade === 'respond') {
        return (...args: unknown[]) => {
          const respond = alvo.respond as (...a: unknown[]) => unknown;
          const predicao = respond.apply(alvo, args);
          return instrumentarPredicao(
            predicao as PredicaoStreamavel,
            aoReceberFragmento,
          );
        };
      }
      const valor = Reflect.get(alvo, propriedade);
      return typeof valor === 'function' ? valor.bind(alvo) : valor;
    },
  }) as LLM;
}

type Fragmento = { content?: unknown };
type PredicaoStreamavel = AsyncIterable<Fragmento> & PromiseLike<unknown>;

/**
 * Envolve a `OngoingPrediction` retornada por `respond`. Continua sendo
 * "thenable" (dá pra `await`) e iterável (`for await`), mas cada fragmento
 * iterado dispara o callback antes de ser entregue a quem consome.
 */
function instrumentarPredicao(
  predicao: PredicaoStreamavel,
  aoReceberFragmento: AoReceberFragmento,
): PredicaoStreamavel {
  return new Proxy(predicao, {
    get(alvo, propriedade) {
      if (propriedade === Symbol.asyncIterator) {
        return function () {
          const original = alvo[Symbol.asyncIterator]();
          const iterador: AsyncIterator<Fragmento> = {
            async next(...args) {
              const resultado = await original.next(...args);
              if (
                !resultado.done &&
                resultado.value &&
                typeof resultado.value.content === 'string'
              ) {
                aoReceberFragmento(resultado.value.content);
              }
              return resultado;
            },
            async return(valor?: unknown) {
              if (typeof original.return === 'function') {
                return original.return(valor);
              }
              return { done: true, value: valor };
            },
            async throw(erro?: unknown) {
              if (typeof original.throw === 'function') {
                return original.throw(erro);
              }
              throw erro;
            },
          };
          return iterador;
        };
      }
      const valor = Reflect.get(alvo, propriedade);
      return typeof valor === 'function' ? valor.bind(alvo) : valor;
    },
  }) as PredicaoStreamavel;
}
