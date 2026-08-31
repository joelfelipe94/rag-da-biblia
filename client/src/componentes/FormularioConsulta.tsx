import { useState, type FormEvent, type KeyboardEvent } from 'react';
import type { StatusServidor } from '../tipos';

type Props = {
  aoEnviar: (pergunta: string) => void;
  habilitado: boolean;
  estado: StatusServidor['estado'];
  emAndamento: boolean;
};

export function FormularioConsulta({
  aoEnviar,
  habilitado,
  estado,
  emAndamento,
}: Props) {
  const [texto, setTexto] = useState('');

  const enviar = (evento: FormEvent) => {
    evento.preventDefault();
    const pergunta = texto.trim();
    if (!pergunta || !habilitado) return;
    aoEnviar(pergunta);
    setTexto('');
  };

  const aoTeclar = (evento: KeyboardEvent<HTMLTextAreaElement>) => {
    if (evento.key === 'Enter' && (evento.metaKey || evento.ctrlKey)) {
      enviar(evento);
    }
  };

  let dica = 'Pergunte algo sobre a Bíblia e pressione ⌘/Ctrl + Enter.';
  if (estado === 'carregando')
    dica = 'Aguarde: o servidor ainda está carregando os modelos…';
  else if (estado === 'erro')
    dica = 'O servidor não conseguiu carregar os modelos. Verifique o LM Studio.';
  else if (emAndamento) dica = 'Processando a consulta anterior…';

  return (
    <form className="formulario" onSubmit={enviar}>
      <textarea
        className="formulario__campo"
        placeholder="Ex.: O que Jesus disse sobre perdão?"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        onKeyDown={aoTeclar}
        rows={3}
      />
      <div className="formulario__rodape">
        <span className="formulario__dica">{dica}</span>
        <button
          type="submit"
          className="formulario__botao"
          disabled={!habilitado || texto.trim().length === 0}
        >
          {emAndamento ? 'Processando…' : 'Perguntar'}
        </button>
      </div>
    </form>
  );
}
