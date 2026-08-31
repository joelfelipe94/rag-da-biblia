export function montarChaveResultado({
  testamento,
  livro,
  numeroCapitulo,
  indiceChunk,
}: {
  testamento: string;
  livro: string;
  numeroCapitulo: number;
  indiceChunk: number;
}): string {
  return `${testamento}|${livro}|${numeroCapitulo}|${indiceChunk}`;
}
