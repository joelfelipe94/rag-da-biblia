import { renderizarMarkdownNoTerminal } from './renderizarMarkdownNoTerminal.js';

const NEGRITO = '\x1b[1m';
const FIM_NEGRITO = '\x1b[22m';

describe('renderizarMarkdownNoTerminal', () => {
  it('converte **trecho** em negrito ANSI', () => {
    expect(renderizarMarkdownNoTerminal('Deus é **amor** eterno')).toBe(
      `Deus é ${NEGRITO}amor${FIM_NEGRITO} eterno`,
    );
  });

  it('converte mais de um trecho em negrito na mesma linha', () => {
    expect(renderizarMarkdownNoTerminal('**João 3:16** e **João 1:1**')).toBe(
      `${NEGRITO}João 3:16${FIM_NEGRITO} e ${NEGRITO}João 1:1${FIM_NEGRITO}`,
    );
  });

  it('transforma um asterisco único no início da linha em bullet', () => {
    const entrada = '* primeiro\n* segundo';
    expect(renderizarMarkdownNoTerminal(entrada)).toBe('• primeiro\n• segundo');
  });

  it('preserva a indentação dos bullets aninhados', () => {
    expect(renderizarMarkdownNoTerminal('  * item aninhado')).toBe(
      '  • item aninhado',
    );
  });

  it('não confunde **negrito** no início da linha com bullet', () => {
    expect(renderizarMarkdownNoTerminal('**Resumo:** confira abaixo')).toBe(
      `${NEGRITO}Resumo:${FIM_NEGRITO} confira abaixo`,
    );
  });

  it('aplica bullet e negrito na mesma linha', () => {
    expect(renderizarMarkdownNoTerminal('* veja **Gênesis 1**')).toBe(
      `• veja ${NEGRITO}Gênesis 1${FIM_NEGRITO}`,
    );
  });

  it('mantém texto sem marcação intacto', () => {
    expect(renderizarMarkdownNoTerminal('linha simples 2 * 3 = 6')).toBe(
      'linha simples 2 * 3 = 6',
    );
  });
});
