import type { EventoBusca, StatusServidor } from './tipos';

/**
 * Abre um stream SSE de busca. A cada evento recebido chama `aoEvento`.
 * Retorna uma função para cancelar/fechar o stream.
 */
export function abrirBusca(
  query: string,
  aoEvento: (evento: EventoBusca) => void,
): () => void {
  const fonte = new EventSource(`/api/search?q=${encodeURIComponent(query)}`);
  let finalizado = false;

  const fechar = () => {
    finalizado = true;
    fonte.close();
  };

  fonte.onmessage = (mensagem) => {
    if (finalizado) return;
    let evento: EventoBusca;
    try {
      evento = JSON.parse(mensagem.data) as EventoBusca;
    } catch {
      return;
    }
    aoEvento(evento);
    if (evento.tipo === 'fim' || evento.tipo === 'erro') {
      fechar();
    }
  };

  fonte.onerror = () => {
    if (finalizado) return;
    aoEvento({
      tipo: 'erro',
      mensagem: 'Conexão com o servidor foi interrompida.',
    });
    fechar();
  };

  return fechar;
}

/** Consulta o endpoint de status/disponibilidade do servidor. */
export async function consultarStatus(): Promise<StatusServidor> {
  const resposta = await fetch('/api/status');
  return (await resposta.json()) as StatusServidor;
}
