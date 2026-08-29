import { jest } from '@jest/globals';

global.jest = jest as any;

// Silencia o streaming que os helpers escrevem direto em stdout durante os
// testes. Testes que fazem jest.spyOn(process.stdout, 'write') passam a
// espionar este no-op — os asserts sobre número/ordem de chamadas continuam
// válidos.
process.stdout.write = (() => true) as typeof process.stdout.write;