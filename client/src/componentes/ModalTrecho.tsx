import { useEffect, useRef } from 'react';
import type { TrechoDTO } from '../tipos';

type Props = {
  trecho: TrechoDTO;
  aoFechar: () => void;
};

export function ModalTrecho({ trecho, aoFechar }: Props) {
  const fecharRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fecharRef.current?.focus();
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') aoFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = '';
    };
  }, [aoFechar]);

  return (
    <div
      className="modal__fundo"
      onClick={aoFechar}
      role="presentation"
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        onClick={(evento) => evento.stopPropagation()}
      >
        <header className="modal__cabecalho">
          <div>
            <h2 id="modal-titulo">
              {trecho.livro} {trecho.numeroCapitulo}
            </h2>
            <p className="modal__sub">
              {trecho.testamento} · livro {trecho.numeroLivro} · chunk{' '}
              {trecho.indiceChunk}
            </p>
          </div>
          <button
            ref={fecharRef}
            type="button"
            className="modal__fechar"
            onClick={aoFechar}
            aria-label="Fechar"
          >
            ×
          </button>
        </header>

        <dl className="modal__scores">
          <div>
            <dt>score final</dt>
            <dd>{trecho.scoreFinal.toFixed(6)}</dd>
          </div>
          {typeof trecho.scoreFts === 'number' && (
            <div>
              <dt>score fts</dt>
              <dd>{trecho.scoreFts.toFixed(6)}</dd>
            </div>
          )}
          {typeof trecho.scoreVetorial === 'number' && (
            <div>
              <dt>score vetorial</dt>
              <dd>{trecho.scoreVetorial.toFixed(6)}</dd>
            </div>
          )}
        </dl>

        <div className="modal__corpo">
          <pre className="modal__texto">{trecho.texto}</pre>
        </div>
      </div>
    </div>
  );
}
