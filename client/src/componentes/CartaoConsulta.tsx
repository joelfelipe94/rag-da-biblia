import type { Consulta, TrechoDTO } from '../tipos';
import { ROTULO_FASE } from '../fases';
import { PainelExpansao } from './PainelExpansao';
import { ListaTrechos } from './ListaTrechos';
import { PainelResposta } from './PainelResposta';

type Props = {
  consulta: Consulta;
  aoAbrirTrecho: (trecho: TrechoDTO) => void;
};

export function CartaoConsulta({ consulta, aoAbrirTrecho }: Props) {
  const carregandoTrechos =
    !consulta.concluida &&
    consulta.trechos.length === 0 &&
    (consulta.fase === 'buscando' || consulta.fase === 'fundindo');

  return (
    <article className="cartao">
      <div className="cartao__pergunta">
        <span className="cartao__rotulo">Pergunta</span>
        <p>{consulta.pergunta}</p>
        {!consulta.concluida && (
          <span className="cartao__fase">{ROTULO_FASE[consulta.fase]}</span>
        )}
      </div>

      <div className="cartao__grade">
        <div className="cartao__coluna-principal">
          <PainelResposta consulta={consulta} aoAbrirTrecho={aoAbrirTrecho} />
        </div>
        <aside className="cartao__lateral">
          <PainelExpansao consulta={consulta} />
          <ListaTrechos
            trechos={consulta.trechos}
            aoAbrirTrecho={aoAbrirTrecho}
            carregando={carregandoTrechos}
          />
        </aside>
      </div>
    </article>
  );
}
