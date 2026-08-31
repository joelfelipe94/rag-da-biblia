import { carregarParametrosDoServidor } from './carregarParametrosDoServidor.js';
import { jest } from '@jest/globals';

describe('carregarParametrosDoServidor', () => {
  function criarArgv(args: string[]): string[] {
    return ['node', 'bible-server', ...args];
  }

  it('carrega parâmetros obrigatórios e aplica padrões', async () => {
    const parametros = await carregarParametrosDoServidor(
      criarArgv(['--input', 'data/biblia.db']),
    );

    expect(parametros).toEqual({
      caminhoDb: 'data/biblia.db',
      porta: 3000,
      topK: 5,
      topKFts: 25,
      topKVetorial: 25,
      pesoFts: 0.5,
      pesoVetorial: 0.5,
      pularHyde: false,
    });
  });

  it('aceita sobrescrita de parâmetros opcionais', async () => {
    const parametros = await carregarParametrosDoServidor(
      criarArgv([
        '--input',
        'data/biblia.db',
        '--port',
        '8080',
        '--top-k',
        '7',
        '--top-k-fts',
        '40',
        '--top-k-vetorial',
        '30',
        '--peso-fts',
        '0.8',
        '--peso-vetorial',
        '0.2',
        '--pular-hyde',
      ]),
    );

    expect(parametros).toEqual({
      caminhoDb: 'data/biblia.db',
      porta: 8080,
      topK: 7,
      topKFts: 40,
      topKVetorial: 30,
      pesoFts: 0.8,
      pesoVetorial: 0.2,
      pularHyde: true,
    });
  });

  it('aceita o alias -p para a porta', async () => {
    const parametros = await carregarParametrosDoServidor(
      criarArgv(['--input', 'data/biblia.db', '-p', '4321']),
    );

    expect(parametros.porta).toBe(4321);
  });

  it('mostra a mensagem de help quando o parametro é usado', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await carregarParametrosDoServidor(criarArgv(['--help']));

    expect(consoleLogSpy).toHaveBeenCalled();
    const saida = consoleLogSpy.mock.calls
      .flat()
      .map((valor) => String(valor))
      .join('\n');

    expect(saida).toMatchInlineSnapshot(`
"Options:
      --version         Show version number                            [boolean]
  -i, --input           Caminho para o arquivo SQLite preprocessado
                                                             [string] [required]
  -p, --port            Porta HTTP em que o servidor vai escutar
                                                        [number] [default: 3000]
      --top-k           Quantidade final de resultados retornados
                                                           [number] [default: 5]
      --top-k-fts       Quantidade de candidatos vindos do FTS
                                                          [number] [default: 25]
      --top-k-vetorial  Quantidade de candidatos vindos da busca vetorial
                                                          [number] [default: 25]
      --peso-fts        Peso da busca lexical na fusão final
                                                         [number] [default: 0.5]
      --peso-vetorial   Peso da busca vetorial na fusão final
                                                         [number] [default: 0.5]
      --pular-hyde      Ignorar a geração do documento hipotético (HyDE)
                                                      [boolean] [default: false]
      --help            Show help                                      [boolean]"
`);

    consoleLogSpy.mockRestore();
  });

  it('falha quando --input está ausente', async () => {
    await expect(
      carregarParametrosDoServidor(criarArgv(['--port', '3000'])),
    ).rejects.toThrow();
  });

  it('falha quando --top-k não é inteiro positivo', async () => {
    await expect(
      carregarParametrosDoServidor(
        criarArgv(['--input', 'data/biblia.db', '--top-k', '0']),
      ),
    ).rejects.toThrow('--top-k deve ser um inteiro positivo');
  });

  it('falha quando --top-k-fts não é inteiro positivo', async () => {
    await expect(
      carregarParametrosDoServidor(
        criarArgv(['--input', 'data/biblia.db', '--top-k-fts', '-1']),
      ),
    ).rejects.toThrow('--top-k-fts deve ser um inteiro positivo');
  });

  it('falha quando --top-k-vetorial não é inteiro positivo', async () => {
    await expect(
      carregarParametrosDoServidor(
        criarArgv(['--input', 'data/biblia.db', '--top-k-vetorial', '1.5']),
      ),
    ).rejects.toThrow('--top-k-vetorial deve ser um inteiro positivo');
  });

  it('falha quando pesos são inválidos', async () => {
    await expect(
      carregarParametrosDoServidor(
        criarArgv([
          '--input',
          'data/biblia.db',
          '--peso-fts',
          '0',
          '--peso-vetorial',
          '0',
        ]),
      ),
    ).rejects.toThrow(
      'Os pesos devem ser não-negativos e com soma maior que zero',
    );
  });

  it('falha quando --port não é inteiro entre 1 e 65535', async () => {
    await expect(
      carregarParametrosDoServidor(
        criarArgv(['--input', 'data/biblia.db', '--port', '70000']),
      ),
    ).rejects.toThrow('--port deve ser um inteiro entre 1 e 65535');
  });

  it('falha quando --port é zero', async () => {
    await expect(
      carregarParametrosDoServidor(
        criarArgv(['--input', 'data/biblia.db', '--port', '0']),
      ),
    ).rejects.toThrow('--port deve ser um inteiro entre 1 e 65535');
  });

  it('falha com opção desconhecida (modo strict)', async () => {
    await expect(
      carregarParametrosDoServidor(
        criarArgv(['--input', 'data/biblia.db', '--nao-existe', '1']),
      ),
    ).rejects.toThrow();
  });
});
