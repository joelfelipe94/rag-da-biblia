import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import {
  adicionarOpcaoEntrada,
  adicionarOpcoesBuscaHibrida,
  extrairParametrosBase,
  validarParametrosBase,
} from './carregarParametrosBase.js';

/**
 * Carrega e valida os parâmetros de linha de comando usados na busca bíblica.
 *
 * As opções de busca híbrida (`--input`, `--top-k`, `--top-k-fts`,
 * `--top-k-vetorial`, `--peso-fts`, `--peso-vetorial`, `--pular-hyde`) e as
 * regras de validação são compartilhadas com o servidor web e vivem em
 * `src/helpers/carregarParametrosBase.ts`. Este carregador acrescenta apenas a
 * opção `--query` (`-q`) com a consulta do usuário.
 *
 * Parâmetros esperados:
 * - `--input` (`-i`): caminho para o banco SQLite preprocessado.
 * - `--query` (`-q`): consulta do usuário.
 * - `--top-k`, `--top-k-fts`, `--top-k-vetorial`: limites de resultados (inteiros positivos).
 * - `--peso-fts`, `--peso-vetorial`: pesos não negativos com soma maior que zero.
 * - `--pular-hyde`: quando `true`, não gera documento hipotético.
 *
 * @param argv Argumentos no formato de `process.argv`.
 * @returns Objeto com todos os parâmetros normalizados para consumo da
 *   aplicação: os campos base (`caminhoDb`, `topK`, `topKFts`, `topKVetorial`,
 *   `pesoFts`, `pesoVetorial`, `pularHyde`) mais `consultaOriginal`.
 * @throws Error Quando algum argumento obrigatório estiver ausente ou inválido.
 */
export async function carregarParametrosDoComando(argv: string[]) {
  const construtor = adicionarOpcaoEntrada(
    yargs(hideBin(argv)).scriptName('search-bible'),
  ).option('query', {
    alias: 'q',
    describe: 'Consulta do usuário para buscar capítulos e trechos bíblicos',
    type: 'string',
    demandOption: true,
  });

  const argumentos = await adicionarOpcoesBuscaHibrida(construtor)
    .check((args) => validarParametrosBase(args))
    .help()
    .strict()
    .exitProcess(false)
    .parse();

  const consultaOriginal = (argumentos.query as string).trim();
  return { ...extrairParametrosBase(argumentos), consultaOriginal };
}
