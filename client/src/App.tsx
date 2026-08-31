import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Consulta, EventoBusca, StatusServidor, TrechoDTO } from './tipos';
import { abrirBusca, consultarStatus } from './sseClient';
import { BadgeStatus } from './componentes/BadgeStatus';
import { FormularioConsulta } from './componentes/FormularioConsulta';
import { CartaoConsulta } from './componentes/CartaoConsulta';
import { ModalTrecho } from './componentes/ModalTrecho';

function novaConsulta(pergunta: string): Consulta {
  return {
    id:
      globalThis.crypto?.randomUUID?.() ??
      `c-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    pergunta,
    fase: 'na-fila',
    expansaoBruta: { lexica: '', parafrase: '', hyde: '' },
    trechos: [],
    resposta: '',
    concluida: false,
  };
}

function aplicarEvento(consulta: Consulta, evento: EventoBusca): Consulta {
  switch (evento.tipo) {
    case 'estado':
      return { ...consulta, fase: evento.fase };
    case 'expansao-fragmento':
      return {
        ...consulta,
        expansaoBruta: {
          ...consulta.expansaoBruta,
          [evento.canal]: consulta.expansaoBruta[evento.canal] + evento.texto,
        },
      };
    case 'expansao-final':
      return { ...consulta, consultaFinal: evento.consulta };
    case 'trechos':
      return { ...consulta, trechos: evento.trechos };
    case 'resposta-fragmento':
      return { ...consulta, resposta: consulta.resposta + evento.texto };
    case 'fim':
      return {
        ...consulta,
        resposta: evento.respostaFinal || consulta.resposta,
        fase: 'concluido',
        concluida: true,
      };
    case 'erro':
      return { ...consulta, erro: evento.mensagem, concluida: true };
    default:
      return consulta;
  }
}

export function App() {
  const [status, setStatus] = useState<StatusServidor | null>(null);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [trechoModal, setTrechoModal] = useState<TrechoDTO | null>(null);
  const cancelarRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let ativo = true;
    const atualizar = async () => {
      try {
        const proximo = await consultarStatus();
        if (ativo) setStatus(proximo);
      } catch {
        if (ativo)
          setStatus({
            estado: 'erro',
            disponivel: false,
            erro: 'Servidor inacessível.',
            modelo: '—',
            modeloEmbedding: '—',
            parametros: {
              topK: 0,
              topKFts: 0,
              topKVetorial: 0,
              pesoFts: 0,
              pesoVetorial: 0,
              pularHyde: false,
            },
          });
      }
    };
    atualizar();
    const intervalo = setInterval(atualizar, 3000);
    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, []);

  useEffect(() => () => cancelarRef.current?.(), []);

  const emAndamento = useMemo(
    () => consultas.some((consulta) => !consulta.concluida),
    [consultas],
  );

  const atualizarConsulta = useCallback(
    (id: string, evento: EventoBusca) => {
      setConsultas((atuais) =>
        atuais.map((consulta) =>
          consulta.id === id ? aplicarEvento(consulta, evento) : consulta,
        ),
      );
    },
    [],
  );

  const enviarConsulta = useCallback(
    (pergunta: string) => {
      const consulta = novaConsulta(pergunta);
      setConsultas((atuais) => [consulta, ...atuais]);
      cancelarRef.current = abrirBusca(pergunta, (evento) => {
        atualizarConsulta(consulta.id, evento);
        if (evento.tipo === 'fim' || evento.tipo === 'erro') {
          cancelarRef.current = null;
        }
      });
    },
    [atualizarConsulta],
  );

  const podePerguntar = status?.estado === 'pronto' && !emAndamento;

  return (
    <div className="app">
      <header className="cabecalho">
        <div>
          <h1>RAG da Bíblia</h1>
          <p className="subtitulo">
            Busca lexical + semântica sobre o texto bíblico, com resposta gerada
            por LLM local.
          </p>
        </div>
        <BadgeStatus status={status} />
      </header>

      <FormularioConsulta
        aoEnviar={enviarConsulta}
        habilitado={Boolean(podePerguntar)}
        estado={status?.estado ?? 'carregando'}
        emAndamento={emAndamento}
      />

      <main className="conversa">
        {consultas.length === 0 && (
          <p className="vazio">
            Faça uma pergunta para ver a expansão da consulta, os trechos
            encontrados e a resposta — tudo em tempo real.
          </p>
        )}
        {consultas.map((consulta) => (
          <CartaoConsulta
            key={consulta.id}
            consulta={consulta}
            aoAbrirTrecho={setTrechoModal}
          />
        ))}
      </main>

      {trechoModal && (
        <ModalTrecho
          trecho={trechoModal}
          aoFechar={() => setTrechoModal(null)}
        />
      )}
    </div>
  );
}
