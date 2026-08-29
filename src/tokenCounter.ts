#!/usr/bin/env node

import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import { LMStudioClient, type LLM } from '@lmstudio/sdk';
import Database from 'better-sqlite3';

/**
 * Executa o fluxo principal do contador de tokens.
 *
 * @param argv Argumentos de linha de comando recebidos pelo processo. Inclui o nome do script.
 * @returns Promise resolvida quando o processamento termina.
 */
async function main(argv: string[]): Promise<void> {
  const lmStudioClient = new LMStudioClient();
  const modeloAlvo = 'google/gemma-4-12b-qat';

  const argumentos = await yargs(hideBin(argv))
    .scriptName('token-counter')
    .command('$0 <n>', 'Conta tokens e mostra os top N capítulos', (cmd) =>
      cmd.positional('n', {
        describe: 'Quantidade de capítulos no top por contagem de tokens',
        type: 'number',
        demandOption: true,
      }),
    )
    .check((args) => {
      const nProcessado = Number(args.n);
      if (!Number.isInteger(nProcessado) || nProcessado <= 0) {
        throw new Error('n deve ser um inteiro positivo');
      }
      return true;
    })
    .help()
    .strict()
    .parse();

  const n = Number(argumentos.n);

  const modelo = await carregarSomenteModeloAlvo(lmStudioClient, modeloAlvo);

  console.log(`Identificador do modelo: ${modelo.identifier}`);

  // Abre o banco SQLite.
  const capitulos = carregaTodosCapitulos(); // Carrega todos os capítulos de uma vez.
  // Memória usada é aproximadamente 4 MB para a tradução de Almeida 1911. Não é necessário carregar todos os capítulos de uma vez, mas para simplificar o código, vamos fazer assim.

  
  console.log(`\nContando tokens para ${capitulos.length} capítulos...\n`);

  const contagensDeTokens: number[] = [];

  // Conta tokens para cada capítulo.
  for (const capitulo of capitulos) {
    const contagemDeTokens = await modelo.countTokens(capitulo.texto);
    console.log(
      `Capitulo ${capitulo.numero_capitulo} (${capitulo.testamento} - ${capitulo.livro}): ${contagemDeTokens} tokens`,
    );
    contagensDeTokens.push(contagemDeTokens);
  }
  const topN = await topNContagemDeTokens(contagensDeTokens, n);
  
  console.log(`\nTop ${n} capítulos com mais tokens: ${topN.join(', ')}`);
  console.log('\nPronto!');
}

type Capitulo = {
  testamento: string;
  numero_capitulo: number;
  livro: string;
  texto: string;
};

/**
 * Carrega todos os capítulos da base SQLite em memória.
 *
 * @returns Lista de capítulos retornada pela consulta na tabela de embeddings.
 */
function carregaTodosCapitulos(): Capitulo[] {
  const banco = new Database('./data/preprocessed.sqlite', { readonly: true });

  // Consulta todos os capítulos da tabela de embeddings.
  const declaracaoPreparada = banco.prepare(
    'SELECT testamento, numero_capitulo, livro, texto FROM tabela_embedding ORDER BY id_testamento, id_livro, numero_capitulo'
  );
  const capitulos = declaracaoPreparada.all() as Capitulo[]; // Carrega todos os capítulos de uma vez.
  banco.close(); // Fecha o banco após carregar os capítulos.
  return capitulos;
};


/**
 * Calcula as N maiores contagens de tokens.
 *
 * @param contagensDeTokens Lista de contagens de tokens por capítulo.
 * @param n Quantidade de elementos a retornar no topo.
 * @returns Lista com as N maiores contagens em ordem decrescente.
 */
async function topNContagemDeTokens(contagensDeTokens: number[], n: number): Promise<number[]> {
  // Ordena por contagem de tokens em ordem decrescente e pega os top N.
  const topN = contagensDeTokens.sort((a, b) => b - a).slice(0, n);
  return topN;
}

/**
 * Mantém somente o modelo alvo carregado no LM Studio.
 *
 * @param cliente Cliente do LM Studio usado para listar, descarregar e carregar modelos.
 * @param modeloAlvo Chave do modelo que deve permanecer carregado.
 * @returns Instância do modelo alvo carregado.
 */
async function carregarSomenteModeloAlvo(cliente: LMStudioClient, modeloAlvo: string): Promise<LLM> {
  const modelosCarregados = await cliente.llm.listLoaded();
  for (const modeloCarregado of modelosCarregados) {
    if (modeloCarregado.modelKey !== modeloAlvo) {
      await cliente.llm.unload(modeloCarregado.identifier);
    }
  }
  const modelo =
    modelosCarregados.find((modeloCarregado) => modeloCarregado.modelKey === modeloAlvo) ??
    (await cliente.llm.load(modeloAlvo));
  return modelo;
}

main(process.argv).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});