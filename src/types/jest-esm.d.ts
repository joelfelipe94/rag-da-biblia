// `@types/jest` não declara `jest.unstable_mockModule`, mas o método existe em
// tempo de execução quando o Jest roda com `--experimental-vm-modules` (ver o
// script `test` no package.json). Esta augmentação torna a API global visível
// para todos os arquivos `*.test.ts` sem precisar importar de `@jest/globals`.
declare global {
  namespace jest {
    function unstable_mockModule(
      moduleName: string,
      moduleFactory: () => unknown,
      options?: { virtual?: boolean },
    ): typeof jest;
  }
}

export {};