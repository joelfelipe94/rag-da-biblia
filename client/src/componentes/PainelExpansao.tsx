import { useState } from 'react';
import type { Consulta } from '../tipos';
import { ROTULO_FASE, faseConcluida } from '../fases';

const CANAIS = [
  {
    chave: 'lexica' as const,
    titulo: 'Consulta lexical (FTS5)',
    fase: 'expandindo-lexica' as const,
  },
  {
    chave: 'parafrase' as const,
    titulo: 'Paráfrases semânticas',
    fase: 'expandindo-parafrase' as const,
  },
  {
    chave: 'hyde' as const,
    titulo: 'Documento hipotético (HyDE)',
    fase: 'expandindo-hyde' as const,
  },
];

export function PainelExpansao({ consulta }: { consulta: Consulta }) {
  const expandindo =
    consulta.fase.startsWith('expandindo') || consulta.fase === 'na-fila';
  const [aberto, setAberto] = useState(true);

  return (
    <section className="expansao">
      <button
        type="button"
        className="expansao__cabecalho"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
      >
        <span className="expansao__seta" aria-hidden="true">
          {aberto ? '▾' : '▸'}
        </span>
        Expansão da consulta
        {expandindo && <span className="spinner" aria-hidden="true" />}
      </button>

      {aberto && (
        <div className="expansao__corpo">
          {CANAIS.map(({ chave, titulo, fase }) => {
            if (chave === 'hyde' && consulta.consultaFinal && !consulta.consultaFinal.hyde) {
              return null;
            }
            const bruto = consulta.expansaoBruta[chave];
            const finalizado =
              consulta.consultaFinal &&
              (chave === 'lexica'
                ? consulta.consultaFinal.lexica
                : chave === 'parafrase'
                  ? consulta.consultaFinal.parafrase.join('\n')
                  : (consulta.consultaFinal.hyde ?? ''));
            const conteudo = finalizado || bruto;
            const ativo =
              consulta.fase === fase ||
              (!bruto && !finalizado && !faseConcluida(consulta.fase, fase));

            return (
              <div key={chave} className="canal">
                <div className="canal__titulo">
                  {titulo}
                  {consulta.fase === fase && (
                    <span className="spinner" aria-hidden="true" />
                  )}
                </div>
                {conteudo ? (
                  <pre className="canal__texto">{conteudo}</pre>
                ) : (
                  <p className="canal__pendente">
                    {ativo ? 'gerando…' : 'aguardando'}
                  </p>
                )}
              </div>
            );
          })}
          {!consulta.concluida && (
            <p className="expansao__fase">{ROTULO_FASE[consulta.fase]}</p>
          )}
        </div>
      )}
    </section>
  );
}
