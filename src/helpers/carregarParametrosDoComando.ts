import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

/**
 * Carrega e valida os parâmetros de linha de comando usados na busca bíblica.
 *
 * Parâmetros esperados:
 * - `--input` (`-i`): caminho para o banco SQLite preprocessado.
 * - `--query` (`-q`): consulta do usuário.
 * - `--top-k`, `--top-k-fts`, `--top-k-vetorial`: limites de resultados (inteiros positivos).
 * - `--peso-fts`, `--peso-vetorial`: pesos não negativos com soma maior que zero.
 * - `--pular-hyde`: quando `true`, não gera documento hipotético.
 *
 * @param argv Argumentos no formato de `process.argv`.
 * @returns Objeto com todos os parâmetros normalizados para consumo da aplicação.
 * @throws Error Quando algum argumento obrigatório estiver ausente ou inválido.
 */
export async function carregarParametrosDoComando(argv: string[]) {
  const argumentos = await yargs(hideBin(argv))
    .scriptName('search-bible')
    .option('input', {
      alias: 'i',
      describe: 'Caminho para o arquivo SQLite preprocessado',
      type: 'string',
      demandOption: true,
    })
    .option('query', {
      alias: 'q',
      describe: 'Consulta do usuário para buscar capítulos e trechos bíblicos',
      type: 'string',
      demandOption: true,
    })
    .option('top-k', {
      describe: 'Quantidade final de resultados retornados',
      type: 'number',
      default: 5,
    })
    .option('top-k-fts', {
      describe: 'Quantidade de candidatos vindos do FTS',
      type: 'number',
      default: 25,
    })
    .option('top-k-vetorial', {
      describe: 'Quantidade de candidatos vindos da busca vetorial',
      type: 'number',
      default: 25,
    })
    .option('peso-fts', {
      describe: 'Peso da busca lexical na fusão final',
      type: 'number',
      default: 0.5,
    })
    .option('peso-vetorial', {
      describe: 'Peso da busca vetorial na fusão final',
      type: 'number',
      default: 0.5,
    })
    .option('pular-hyde', {
      describe: 'Ignorar a geração do documento hipotético (HyDE)',
      type: 'boolean',
      default: false,
    })
    .check((args) => {
      const topK = Number(args['top-k']);
      const topKFts = Number(args['top-k-fts']);
      const topKVetorial = Number(args['top-k-vetorial']);
      const pesoFts = Number(args['peso-fts']);
      const pesoVetorial = Number(args['peso-vetorial']);

      if (!Number.isInteger(topK) || topK <= 0) {
        throw new Error('--top-k deve ser um inteiro positivo');
      }

      if (!Number.isInteger(topKFts) || topKFts <= 0) {
        throw new Error('--top-k-fts deve ser um inteiro positivo');
      }

      if (!Number.isInteger(topKVetorial) || topKVetorial <= 0) {
        throw new Error('--top-k-vetorial deve ser um inteiro positivo');
      }

      if (pesoFts < 0 || pesoVetorial < 0 || pesoFts + pesoVetorial <= 0) {
        throw new Error(
          'Os pesos devem ser não-negativos e com soma maior que zero'
        );
      }

      return true;
    })
    .help()
    .strict()
    .exitProcess(false)
    .parse();

  const caminhoDb = argumentos.input as string;
  const consultaOriginal = (argumentos.query as string).trim();
  const topK = Number(argumentos['top-k']);
  const topKFts = Number(argumentos['top-k-fts']);
  const topKVetorial = Number(argumentos['top-k-vetorial']);
  const pesoFts = Number(argumentos['peso-fts']);
  const pesoVetorial = Number(argumentos['peso-vetorial']);
  const pularHyde = Boolean(argumentos['pular-hyde']);
  return { consultaOriginal, pularHyde, caminhoDb, topKFts, topKVetorial, topK, pesoFts, pesoVetorial };
}