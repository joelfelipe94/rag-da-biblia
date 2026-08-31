import { useState } from 'react';
import type { StatusServidor } from '../tipos';

const ROTULO: Record<StatusServidor['estado'], string> = {
  carregando: 'Carregando modelos…',
  pronto: 'Disponível',
  erro: 'Erro',
};

export function BadgeStatus({ status }: { status: StatusServidor | null }) {
  const [aberto, setAberto] = useState(false);
  const estado = status?.estado ?? 'carregando';

  return (
    <div className={`status status--${estado}`}>
      <button
        type="button"
        className="status__botao"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
      >
        <span className="status__ponto" aria-hidden="true" />
        {ROTULO[estado]}
      </button>

      {aberto && status && (
        <div className="status__detalhe">
          {status.erro && <p className="status__erro">{status.erro}</p>}
          <dl>
            <dt>LLM</dt>
            <dd>{status.modelo}</dd>
            <dt>Embeddings</dt>
            <dd>{status.modeloEmbedding}</dd>
            <dt>top-k</dt>
            <dd>
              {status.parametros.topK} (fts {status.parametros.topKFts} · vet{' '}
              {status.parametros.topKVetorial})
            </dd>
            <dt>pesos</dt>
            <dd>
              fts {status.parametros.pesoFts} · vet {status.parametros.pesoVetorial}
            </dd>
            <dt>HyDE</dt>
            <dd>{status.parametros.pularHyde ? 'desligado' : 'ligado'}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
