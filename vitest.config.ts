import { defineConfig } from 'vitest/config';

// Config separada do vite.config.ts de proposito: o vite.config.ts carrega o plugin
// do Tailwind e o gerador de CSP, que nao tem nada a ver com rodar testes de funcao pura.
// Nenhum ambiente de DOM aqui — tudo que testamos e logica pura (sem React).
// `electron/**/*.test.cjs` entra porque alguns invariantes so podem ser verificados onde o
// I/O acontece. A guarda que impede o app de alterar o hero_grid_config.json do jogador tem
// de comparar os bytes que vao para o disco, no processo main — nao um objeto que alguem
// prometeu ter serializado direito. Deixar esse arquivo fora do `include` seria manter a
// propriedade mais importante do app como a unica sem teste.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'electron/**/*.test.cjs'],
    // `globals: true` e o que torna o glob `.test.cjs` acima realmente utilizavel. O Vitest 4
    // recusa ser importado por `require()` e um `import` dentro de um arquivo .cjs quebra o parse
    // do oxlint, que trata .cjs como script CommonJS. Com os globais ligados, um teste .cjs usa
    // `describe`/`it`/`expect`/`vi` do ambiente e continua sendo CommonJS valido. Os testes de
    // `src/` seguem importando explicitamente — os globais so somam, nao substituem.
    globals: true,
  },
});
