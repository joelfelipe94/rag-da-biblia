import type { Consulta, TrechoDTO } from '../tipos';
import { TextoComReferencias } from './TextoComReferencias';

type Props = {
  consulta: Consulta;
  aoAbrirTrecho: (trecho: TrechoDTO) => void;
};

export function PainelResposta({ consulta, aoAbrirTrecho }: Props) {
  const gerando = consulta.fase === 'gerando';
  const semResposta = consulta.resposta.length === 0;

  return (
    <section className="resposta">
      <h3 className="resposta__titulo">
        Resposta com base na Bíblia
        {gerando && <span className="spinner" aria-hidden="true" />}
      </h3>

      {consulta.erro ? (
        <p className="resposta__erro">⚠ {consulta.erro}</p>
      ) : semResposta ? (
        <p className="resposta__pendente">
          {consulta.concluida
            ? 'Sem resposta.'
            : gerando
              ? 'escrevendo…'
              : 'aguardando os trechos…'}
        </p>
      ) : (
        <div className="resposta__texto">
          <TextoComReferencias
            texto={consulta.resposta}
            trechos={consulta.trechos}
            aoAbrirTrecho={aoAbrirTrecho}
          />
          {gerando && <span className="cursor-piscando" aria-hidden="true" />}
        </div>
      )}
    </section>
  );
}
