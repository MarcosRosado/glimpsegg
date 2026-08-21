import { defineConfig } from 'vitest/config';

// Config separada do vite.config.ts de proposito: o vite.config.ts carrega o plugin
// do Tailwind e o gerador de CSP, que nao tem nada a ver com rodar testes de funcao pura.
// Nenhum ambiente de DOM aqui — tudo que testamos e logica pura (sem React).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
