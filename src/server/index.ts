import path from 'node:path';
import { existsSync } from 'node:fs';

import express, { type Request, type Response } from 'express';
import { LMStudioClient, type LLM, type EmbeddingModel } from '@lmstudio/sdk';

import { carregarSomenteModeloAlvo } from '../helpers/search/carregarSomenteModeloAlvo.js';
import { carregarSomenteModeloAlvoEmbedding } from '../helpers/search/carregarSomenteModeloAlvoEmbedding.js';

import { executarBusca } from './lib/pipeline.js';
import type { EventoBusca } from './lib/eventos.js';
import { carregarParametrosDoServidor } from '../helpers/carregarParametrosDoServidor.js';
import { MODELO_ALVO, MODELO_EMBEDDING_ALVO } from '../helpers/modelos.js';

// O servidor é sempre iniciado a partir da raiz do projeto (scripts npm),
// então os estáticos do cliente ficam em `<raiz>/client/dist`.
const dirCliente = path.resolve(process.cwd(), 'client/dist');

type EstadoServidor = 'carregando' | 'pronto' | 'erro';

async function principal(): Promise<void> {
  const parametros = await carregarParametrosDoServidor(process.argv);

  let estado: EstadoServidor = 'carregando';
  let mensagemErro: string | undefined;
  let modelo: LLM | undefined;
  let modeloEmbedding: EmbeddingModel | undefined;

  const app = express();
  app.use(express.json());

  // --- Status e disponibilidade -------------------------------------------------
  app.get('/api/status', (_req: Request, res: Response) => {
    let codigo: number;
    switch (estado) {
      case 'pronto':
        codigo = 200;
        break;
      case 'erro':
        codigo = 500;
        break;
      case 'carregando':
      default:
        codigo = 503;
        break;
    }
    res.status(codigo).json({
      estado,
      disponivel: estado === 'pronto',
      erro: mensagemErro,
      modelo: MODELO_ALVO,
      modeloEmbedding: MODELO_EMBEDDING_ALVO,
      parametros: {
        topK: parametros.topK,
        topKFts: parametros.topKFts,
        topKVetorial: parametros.topKVetorial,
        pesoFts: parametros.pesoFts,
        pesoVetorial: parametros.pesoVetorial,
        pularHyde: parametros.pularHyde,
      },
    });
  });

  // --- Busca (SSE) ------------------------------------------------------------
  // A única entrada vinda do cliente é a query (`?q=`); todos os demais
  // parâmetros vêm da linha de comando do servidor.
  app.get('/api/search', async (req: Request, res: Response) => {
    if (estado !== 'pronto' || !modelo || !modeloEmbedding) {
      res.status(503).json({
        erro: 'Os modelos ainda não foram carregados. Consulte /api/status.',
      });
      return;
    }

    const query = String(req.query.q ?? '').trim();
    if (!query) {
      res.status(400).json({ erro: 'O parâmetro de consulta "q" é obrigatório.' });
      return;
    }

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const emitir = (evento: EventoBusca): void => {
      res.write(`data: ${JSON.stringify(evento)}\n\n`);
    };

    let abortado = false;
    req.on('close', () => {
      abortado = true;
    });

    // Comentários SSE periódicos evitam que proxies fechem a conexão ociosa.
    const pulso = setInterval(() => {
      if (!abortado) res.write(': keep-alive\n\n');
    }, 15000);

    emitir({ tipo: 'estado', fase: 'na-fila' });

    try {
      await enfileirar(async () => {
        if (abortado) return;
        await executarBusca({
          query,
          parametros,
          modelo: modelo as LLM,
          modeloEmbedding: modeloEmbedding as EmbeddingModel,
          emitir,
          estaAbortado: () => abortado,
        });
      });
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      if (!abortado) emitir({ tipo: 'erro', mensagem });
      console.error('Erro ao processar busca:', erro);
    } finally {
      clearInterval(pulso);
      res.end();
    }
  });

  // --- Cliente React buildado (produção) -----------------------------------
  if (existsSync(dirCliente)) {
    app.use(express.static(dirCliente));
    app.use((req: Request, res: Response, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(dirCliente, 'index.html'));
    });
    console.log(`Servindo cliente estático de ${dirCliente}`);
  } else {
    console.log(
      'Cliente buildado não encontrado (client/dist). Rode `npm run client` para o dev server do Vite.',
    );
  }

  app.listen(parametros.porta, () => {
    console.log(
      `Servidor ouvindo em http://localhost:${parametros.porta} (estado: ${estado})`,
    );
  });

  // --- Carregamento dos modelos ANTES de aceitar buscas -------------------
  try {
    const cliente = new LMStudioClient();
    console.log(`Carregando modelo LLM "${MODELO_ALVO}"...`);
    modelo = await carregarSomenteModeloAlvo(cliente, MODELO_ALVO);
    console.log(`Carregando modelo de embedding "${MODELO_EMBEDDING_ALVO}"...`);
    modeloEmbedding = await carregarSomenteModeloAlvoEmbedding(
      cliente,
      MODELO_EMBEDDING_ALVO,
    );
    estado = 'pronto';
    console.log('Modelos carregados. Servidor disponível para buscas.');
  } catch (erro) {
    estado = 'erro';
    mensagemErro = erro instanceof Error ? erro.message : String(erro);
    console.error('Falha ao carregar os modelos:', erro);
  }
}

/**
 * Serializa as buscas: com um único LLM local, processar uma de cada vez
 * reproduz a experiência do terminal e evita respostas intercaladas.
 */
let cadeia: Promise<unknown> = Promise.resolve();
function enfileirar<T>(tarefa: () => Promise<T>): Promise<T> {
  const proxima = cadeia.then(tarefa, tarefa);
  cadeia = proxima.catch(() => undefined);
  return proxima;
}

principal().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
