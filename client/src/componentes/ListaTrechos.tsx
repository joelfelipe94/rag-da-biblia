import type { TrechoDTO } from '../tipos';

type Props = {
  trechos: TrechoDTO[];
  aoAbrirTrecho: (trecho: TrechoDTO) => void;
  carregando: boolean;
};

export function ListaTrechos({ trechos, aoAbrirTrecho, carregando }: Props) {
  if (trechos.length === 0) {
    return (
      <section className="trechos">
        <h3 className="trechos__titulo">Trechos encontrados</h3>
        <p className="trechos__vazio">
          {carregando ? 'buscando…' : 'nenhum trecho ainda'}
        </p>
      </section>
    );
  }

  return (
    <section className="trechos">
      <h3 className="trechos__titulo">
        Trechos encontrados <span className="trechos__contagem">{trechos.length}</span>
      </h3>
      <ol className="trechos__lista">
        {trechos.map((trecho) => (
          <li key={trecho.id}>
            <button
              type="button"
              className="trecho-chip"
              onClick={() => aoAbrirTrecho(trecho)}
            >
              <span className="trecho-chip__ref">{trecho.referencia}</span>
              <span className="trecho-chip__meta">{trecho.testamento}</span>
              <span className="trecho-chip__score">
                {trecho.scoreFinal.toFixed(4)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
