import type { Argv } from 'yargs';

/**
 * Parâmetros compartilhados entre o comando `search-bible`
 * (`carregarParametrosDoComando`) e o servidor web
 * (`carregarParametrosDoServidor`).
 *
 * Reúne o caminho do banco preprocessado, os limites de candidatos/resultados
 * das buscas lexical e vetorial, os pesos usados na fusão final e a flag do
 * HyDE. Cada carregador estende este conjunto com as opções que só fazem
 * sentido no seu contexto: `--query` no comando, `--port` no servidor.
 */
export type ParametrosBase = {
  /** Caminho para o arquivo SQLite preprocessado (`--input`/`-i`). */
  caminhoDb: string;
  /** Quantidade final de resultados retornados (`--top-k`). */
  topK: number;
  /** Quantidade de candidatos vindos do FTS (`--top-k-fts`). */
  topKFts: number;
  /** Quantidade de candidatos vindos da busca vetorial (`--top-k-vetorial`). */
  topKVetorial: number;
  /** Peso da busca lexical na fusão final (`--peso-fts`). */
  pesoFts: number;
  /** Peso da busca vetorial na fusão final (`--peso-vetorial`). */
  pesoVetorial: number;
  /** Quando `true`, ignora a geração do documento hipotético (`--pular-hyde`). */
  pularHyde: boolean;
};

/**
 * Registra na instância do yargs a opção `--input`/`-i` (obrigatória), comum aos
 * dois carregadores de parâmetros.
 *
 * É oferecida separadamente de {@link adicionarOpcoesBuscaHibrida} para que cada
 * carregador possa intercalar as suas opções específicas (`--query`, `--port`)
 * logo após `--input`, preservando a ordem em que as flags aparecem no `--help`.
 *
 * @param yargsInstance Instância do yargs já criada (por exemplo, com
 *   `scriptName` definido).
 * @returns A mesma instância, tipada com a opção `--input` adicionada, pronta
 *   para continuar o encadeamento.
 */
export function adicionarOpcaoEntrada<T>(yargsInstance: Argv<T>) {
  return yargsInstance.option('input', {
    alias: 'i',
    describe: 'Caminho para o arquivo SQLite preprocessado',
    type: 'string',
    demandOption: true,
  });
}

/**
 * Registra na instância do yargs as opções que controlam a busca híbrida e são
 * idênticas nos dois carregadores: `--top-k`, `--top-k-fts`, `--top-k-vetorial`,
 * `--peso-fts`, `--peso-vetorial` e `--pular-hyde`, com os mesmos textos de
 * ajuda e valores padrão.
 *
 * A validação numérica dessas opções fica em {@link validarParametrosBase}, e a
 * normalização dos valores parseados em {@link extrairParametrosBase}.
 *
 * @param yargsInstance Instância do yargs (normalmente já com `--input` e as
 *   opções específicas do carregador adicionadas).
 * @returns A mesma instância, tipada com as opções de busca adicionadas.
 */
export function adicionarOpcoesBuscaHibrida<T>(yargsInstance: Argv<T>) {
  return yargsInstance
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
    });
}

/**
 * Valida as opções de busca híbrida já parseadas pelo yargs, aplicando as mesmas
 * regras nos dois carregadores. Pensada para ser chamada de dentro do `.check()`
 * do yargs.
 *
 * Regras verificadas:
 * - `--top-k`, `--top-k-fts` e `--top-k-vetorial` precisam ser inteiros
 *   positivos;
 * - `--peso-fts` e `--peso-vetorial` precisam ser não-negativos e ter soma
 *   maior que zero.
 *
 * @param args Argumentos parseados recebidos no callback de `.check()`.
 * @returns `true` quando todas as regras são satisfeitas (contrato do
 *   `.check()`).
 * @throws Error Com mensagem descritiva quando alguma regra é violada.
 */
export function validarParametrosBase(args: Record<string, unknown>): true {
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
      'Os pesos devem ser não-negativos e com soma maior que zero',
    );
  }

  return true;
}

/**
 * Extrai e normaliza os parâmetros base a partir do objeto retornado por
 * `yargs(...).parse()`, convertendo cada valor para o tipo final consumido pela
 * aplicação (`input` vira `caminhoDb`, os limites viram `number`, `--pular-hyde`
 * vira `boolean`).
 *
 * @param argumentos Objeto de argumentos já parseado e validado pelo yargs.
 * @returns Os parâmetros base normalizados.
 */
export function extrairParametrosBase(
  argumentos: Record<string, unknown>,
): ParametrosBase {
  return {
    caminhoDb: argumentos['input'] as string,
    topK: Number(argumentos['top-k']),
    topKFts: Number(argumentos['top-k-fts']),
    topKVetorial: Number(argumentos['top-k-vetorial']),
    pesoFts: Number(argumentos['peso-fts']),
    pesoVetorial: Number(argumentos['peso-vetorial']),
    pularHyde: Boolean(argumentos['pular-hyde']),
  };
}
