import { carregarParametrosDoComando } from './carregarParametrosDoComando.js';
import { jest } from '@jest/globals';

describe('carregarParametrosDoComando', () => {
  function criarArgv(args: string[]): string[] {
    return ['node', 'search-bible', ...args];
  }

  it('carrega parâmetros obrigatórios e aplica padrões', async () => {
    const parametros = await carregarParametrosDoComando(
      criarArgv(['--input', 'data/biblia.db', '--query', '  amor e fe  ']),
    );

    expect(parametros).toEqual({
      caminhoDb: 'data/biblia.db',
      consultaOriginal: 'amor e fe',
      topK: 5,
      topKFts: 25,
      topKVetorial: 25,
      pesoFts: 0.5,
      pesoVetorial: 0.5,
      pularHyde: false,
    });
  });

  it('aceita sobrescrita de parâmetros opcionais', async () => {
    const parametros = await carregarParametrosDoComando(
      criarArgv([
        '--input',
        'data/biblia.db',
        '--query',
        'esperanca',
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
      consultaOriginal: 'esperanca',
      topK: 7,
      topKFts: 40,
      topKVetorial: 30,
      pesoFts: 0.8,
      pesoVetorial: 0.2,
      pularHyde: true,
    });
  });

  it('mostra a mensagem de help quando o parametro é usado', async () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await expect(
      carregarParametrosDoComando(
        criarArgv([
          '--help',
        ]),
      ),
    ).rejects.toThrow("Cannot read properties of undefined (reading 'trim')");

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
  -q, --query           Consulta do usuário para buscar capítulos e trechos
                        bíblicos                             [string] [required]
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
  });

  it('falha quando --top-k não é inteiro positivo', async () => {
    await expect(
      carregarParametrosDoComando(
        criarArgv([
          '--input',
          'data/biblia.db',
          '--query',
          'fe',
          '--top-k',
          '0',
        ]),
      ),
    ).rejects.toThrow('--top-k deve ser um inteiro positivo');
  });

  it('falha quando --top-k-fts não é inteiro positivo', async () => {
    await expect(
      carregarParametrosDoComando(
        criarArgv([
          '--input',
          'data/biblia.db',
          '--query',
          'fe',
          '--top-k-fts',
          '-1',
        ]),
      ),
    ).rejects.toThrow('--top-k-fts deve ser um inteiro positivo');
  });

  it('falha quando --top-k-vetorial não é inteiro positivo', async () => {
    await expect(
      carregarParametrosDoComando(
        criarArgv([
          '--input',
          'data/biblia.db',
          '--query',
          'fe',
          '--top-k-vetorial',
          '1.5',
        ]),
      ),
    ).rejects.toThrow('--top-k-vetorial deve ser um inteiro positivo');
  });

  it('falha quando pesos são inválidos', async () => {
    await expect(
      carregarParametrosDoComando(
        criarArgv([
          '--input',
          'data/biblia.db',
          '--query',
          'fe',
          '--peso-fts',
          '0',
          '--peso-vetorial',
          '0',
        ]),
      ),
    ).rejects.toThrow('Os pesos devem ser não-negativos e com soma maior que zero');
  });

  it('falha com opção desconhecida (modo strict)', async () => {
    await expect(
      carregarParametrosDoComando(
        criarArgv(['--input', 'data/biblia.db', '--query', 'fe', '--nao-existe', '1']),
      ),
    ).rejects.toThrow();
  });
});
