import { dividirEmChunks } from './dividirEmChunks.js';
import type { PreTrainedTokenizer } from '@huggingface/transformers';

/**
 * Cria um tokenizer mockado onde cada palavra separada por espaço é um token.
 * Isso permite testes determinísticos sem carregar um modelo real.
 */
function criarTokenizerMock(): PreTrainedTokenizer {
  const palavraParaToken = (palavra: string) => {
    return palavra.charCodeAt(0); // o token é o código ASCII do primeiro caractere da palavra.
  }; // Cada palavra é um token
  return {
    encode: (texto: string) => texto.split('').filter((c) => c !== ' ').map(palavraParaToken),
  } as unknown as PreTrainedTokenizer;
}

describe ('mock de tokenizer', () => {
  const tokenizer = criarTokenizerMock();

  it('tokeniza corretamente palavras de um único caractere', () => {
    const texto = 'a b c d e';
    const tokens = tokenizer.encode(texto);
    expect(tokens).toEqual([97, 98, 99, 100, 101]); // códigos ASCII de a, b, c, d, e
  });

  it('ignora espaços extras e linhas vazias', () => {
    const texto = 'a   b\n\nc  d e';
    const tokens = tokenizer.encode(texto);
    expect(tokens).toEqual([97, 98, 10, 10, 99, 100, 101]);
  });
});

describe('dividirEmChunks', () => {
  const tokenizer = criarTokenizerMock();
  describe('quando o texto cabe em um único chunk', () => {
    it('retorna o texto original em um array de um elemento', async () => {
      const texto = 'um dois tres quatro';
      const resultado = await dividirEmChunks(texto, tokenizer, 100);
      expect(resultado).toEqual([texto]);
    });

    it('retorna chunk único quando tokens == maxTokens', async () => {
      // "a b c" => 3 tokens
      const texto = 'a b c';
      const resultado = await dividirEmChunks(texto, tokenizer, 3);
      expect(resultado).toEqual([texto]);
    });
  });


  // Cada linha abaixo tem exatamente 3 tokens (palavras).
  // Com maxTokens=7: duas linhas + separador = 3+1+3 = 7 <= 7, satisfazendo o
  // invariante do algoritmo (qualquer dois linhas consecutivos devem caber juntos).
  const linhas3Tokens = [
    'a b c',
    'd e f',
    'g h i',
    'j k l',
    'm n o',
    'p q r',
  ];

  describe('quando o texto precisa ser dividido', () => {
    it('divide em múltiplos chunks quando o texto excede maxTokens', async () => {
      // 6 linhas × 3 tokens = 18 tokens; maxTokens=7 força múltiplos chunks
      const texto = linhas3Tokens.join('\n');
      const resultado = await dividirEmChunks(texto, tokenizer, 7);
      expect(resultado.length).toBeGreaterThan(1);
    });

    it('cada chunk respeita o limite máximo de tokens', async () => {
      const maxTokens = 7;
      const texto = linhas3Tokens.join('\n');
      const resultado = await dividirEmChunks(texto, tokenizer, maxTokens);

      for (const chunk of resultado) {
        const tokenCount = tokenizer.encode(chunk).length;
        expect(tokenCount).toBeLessThanOrEqual(maxTokens);
      }
    });

    it('o chunk seguinte começa com a última linha do chunk anterior (overlap)', async () => {
      // 3 linhas × 3 tokens, maxTokens=7:
      //   L1 entra no chunk (tokens=4). L2 causaria 8>7 → salva [L1], novo chunk=[L1,L2] (overlap).
      //   L3 causaria 7+4=11>7 → salva [L1,L2], novo chunk=[L2,L3] (overlap).
      const texto = linhas3Tokens.slice(0, 3).join('\n');
      const resultado = await dividirEmChunks(texto, tokenizer, 7);

      expect(resultado.length).toBeGreaterThanOrEqual(2);

      const linhasChunk1 = resultado[0]!.split('\n');
      const ultimaLinhaChunk1 = linhasChunk1[linhasChunk1.length - 1];
      const primeiraLinhaChunk2 = resultado[1]!.split('\n')[0];

      expect(primeiraLinhaChunk2).toBe(ultimaLinhaChunk1);
    });

    it('todas as linhas do texto original aparecem em pelo menos um chunk', async () => {
      const texto = linhas3Tokens.join('\n');
      const resultado = await dividirEmChunks(texto, tokenizer, 7);

      for (const linha of linhas3Tokens) {
        const aparece = resultado.some((chunk) => chunk.includes(linha));
        expect(aparece).toBe(true);
      }
    });
  });

  describe('casos extremos', () => {
    it('retorna um chunk para texto com uma única linha', async () => {
      const texto = 'linha única com alguns tokens aqui';
      const resultado = await dividirEmChunks(texto, tokenizer, 100);
      expect(resultado).toHaveLength(1);
      expect(resultado[0]).toBe(texto);
    });

    it('retorna um chunk para texto vazio', async () => {
      const resultado = await dividirEmChunks('', tokenizer, 10);
      expect(resultado).toHaveLength(1);
      expect(resultado[0]).toBe('');
    });
  });
});
