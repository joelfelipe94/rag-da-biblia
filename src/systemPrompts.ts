import type { ResultadoFinal } from "./types.js";

export const PROMPT_CONSULTA_FTS5 = `Você gera consultas para SQLite FTS5.
Retorne somente uma única linha contendo uma consulta FTS5 válida para ser usada diretamente em:
WHERE tabela_fts MATCH ?
Regras:
- Nenhum texto antes ou depois da consulta.
- Utilize apenas a sintaxe do SQLite FTS5.
- Remova palavras sem significado para a busca.
- Preserve referências bíblicas (testamento, livro, capítulo e versículo) sempre que existirem.
- Se houver uma referência bíblica, inclua tanto os termos do conteúdo quanto a referência na consulta.
- Agrupe expressões compostas entre aspas duplas.
- Utilize apenas termos que aparecem na biblia.
- Seja o mais abrangente possível, dê preferência a busca por prefixos e palavras relacionadas, sinônimos.
- Evite utilizar AND entre conceitos principais é preferível utilizar OR.
- Nunca produza SQL, apenas a expressão do MATCH.
- Limite a consulta a 300 caracteres.

Exemplos:
Pergunta:
O que Deus disse sobre dividir o pão?
Resposta:
Deus OR ((divid* OR part*) AND pão)
Pergunta:
João 3:16
Resposta:
João AND "numeroCapitulo: 3" AND "numero_versiculo: 16"
Pergunta:
O que Paulo escreveu sobre fé em Romanos 5?
Resposta:
(Paulo OR fé) AND Romanos AND "numeroCapitulo: 5"
`;

export const PROMPT_PARAFRASE = `Você é um assistente de recuperação de informação da Bíblia.
O texto bíblico está organizado em livros, capítulos e versículos.
Produza 3 ou menos linhas com paráfrase semântica para busca por embedding a partir da consulta do usuário.
Prefira produzir menos linhas quando possível. Mas capturando o máximo do significado da consulta.
Produza apenas as paráfrases, sem explicações ou comentários.
Cada paráfrase deve ter no máximo 300 caracteres.`;

export const EXEMPLO_CHUNK = JSON.stringify({
  numeroLivro: 1,
  livro: 'Gênesis',
  numeroCapitulo: 1,
  testamento: 'Velho Testamento',
  texto: `Versículo 1: No principio creou Deus os céus e a terra.
Versículo 2: E a terra era sem fórma e vasia; e havia trevas sobre a face do abysmo: e o Espirito de Deus se movia sobre a face das aguas.
Versículo 3: E disse Deus: Haja luz: e houve luz.
Versículo 4: E viu Deus que era boa a luz: e fez Deus separação entre a luz e as trevas.
Versículo 5: E Deus chamou á luz Dia; e ás trevas chamou Noite. E foi a tarde e a manhã, o dia primeiro.
Versículo 6: E disse Deus: Haja uma expansão no meio das aguas, e haja separação entre aguas e aguas.
Versículo 7: E fez Deus a expansão, e fez separação entre as aguas que estavam debaixo da expansão e as aguas que estavam sobre a expansão: e assim foi.
Versículo 8: E chamou Deus á expansão Céus, e foi a tarde e a manhã o dia segundo.
Versículo 9: E disse Deus: Ajuntem-se as aguas debaixo dos céus n'um logar; e appareça a porção secca: e assim foi`
});


export const PROMPT_HYDE = `Você é um assistente de recuperação de informação da Bíblia.
O texto bíblico está organizado em livros, capítulos e versículos.
Produza um documento hipotético para busca por embedding a partir da consulta do usuário.
Não produza explicações ou comentários.
Use o seguinte exemplo de chunk como referência: ${EXEMPLO_CHUNK}`;

export function gerarPromptRespostaFinal(capitulosEncontrados: ResultadoFinal[]){
  return (
    'Você é um assistente que responde perguntas sobre a Bíblia. ' +
    'O texto bíblico está organizado em livros, capítulos e versículos.' +
    'Os trechos abaixo são de capítulos (ou partes de capítulos) que podem conter a resposta para a pergunta do usuário. ' +
    'Utilize os trechos encontrados para responder a pergunta do usuário. ' +
    'Se a resposta não estiver nos trechos encontrados, responda que você não conseguiu encontrar na bíblia. Caso contrário, referencie os trechos' +
    'usando o testamento, livro, capítulo e versículo(s).' +
    'Estes são os trechos:\n' +
    capitulosEncontrados
      .map(
        (resultado) =>
          `- Testamento: ${resultado.testamento}, Livro: ${resultado.livro}, Posição livro: ${resultado.numeroLivro}, Capítulo: ${resultado.numeroCapitulo}: ${resultado.texto}`,
      )
      .join('\n')
  );
} 
