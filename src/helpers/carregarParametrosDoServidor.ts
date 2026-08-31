import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import {
  adicionarOpcaoEntrada,
  adicionarOpcoesBuscaHibrida,
  extrairParametrosBase,
  validarParametrosBase,
  type ParametrosBase,
} from './carregarParametrosBase.js';

export type ParametrosServidor = ParametrosBase & {
  porta: number;
};

/**
 * Carrega e valida os parâmetros de linha de comando do servidor web.
 *
 * As opções de busca híbrida (`--input`, `--top-k`, `--top-k-fts`,
 * `--top-k-vetorial`, `--peso-fts`, `--peso-vetorial`, `--pular-hyde`) e as
 * regras de validação são compartilhadas com o comando `search-bible` e vivem
 * em `src/helpers/carregarParametrosBase.ts`.
 *
 * As diferenças em relação ao `search-bible` são:
 * - **não há `--query`**: a consulta chega pela API, nunca pela linha de comando;
 * - há um `--port` (`-p`) para escolher a porta HTTP, validado como inteiro
 *   entre 1 e 65535.
 *
 * @param argv Argumentos no formato de `process.argv`.
 * @returns Os parâmetros base normalizados mais `porta`, prontos para o servidor
 *   e para o pipeline de busca.
 * @throws Error Quando algum argumento for inválido.
 */
export async function carregarParametrosDoServidor(
  argv: string[],
): Promise<ParametrosServidor> {
  const construtor = adicionarOpcaoEntrada(
    yargs(hideBin(argv)).scriptName('bible-server'),
  ).option('port', {
    alias: 'p',
    describe: 'Porta HTTP em que o servidor vai escutar',
    type: 'number',
    default: 3000,
  });

  const argumentos = await adicionarOpcoesBuscaHibrida(construtor)
    .check((args) => {
      validarParametrosBase(args);

      const porta = Number(args['port']);
      if (!Number.isInteger(porta) || porta <= 0 || porta > 65535) {
        throw new Error('--port deve ser um inteiro entre 1 e 65535');
      }

      return true;
    })
    .help()
    .strict()
    .exitProcess(false)
    .parse();

  return {
    ...extrairParametrosBase(argumentos),
    porta: Number(argumentos['port']),
  };
}
