import { defineConfig } from 'vitest/config';

// Config separada do vite.config.ts de proposito: o vite.config.ts carrega o plugin
// do Tailwind e o gerador de CSP, que nao tem nada a ver com rodar testes de funcao pura.
// Nenhum ambiente de DOM aqui — tudo que testamos e logica pura (sem React).
//
// Toda a suite mora em `tests/`, espelhando a arvore de `src/` (e `tests/electron/` para o
// processo main). Os testes ficam FORA do codigo de producao: `src/` e `electron/` contem
// so o que o app embarca, e o `include` abaixo e o unico lugar que precisa saber disso.
//
// `tests/**/*.test.cjs` cobre o processo main porque alguns invariantes so podem ser
// verificados onde o I/O acontece. A guarda que impede o app de alterar o
// hero_grid_config.json do jogador tem de comparar os bytes que vao para o disco — nao um
// objeto que alguem prometeu ter serializado direito. Deixar esses arquivos fora do
// `include` seria manter a propriedade mais importante do app como a unica sem teste.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.cjs'],
    // `globals: true` e o que torna o glob `.test.cjs` acima realmente utilizavel. O Vitest 4
    // recusa ser importado por `require()` e um `import` dentro de um arquivo .cjs quebra o parse
    // do oxlint, que trata .cjs como script CommonJS. Com os globais ligados, um teste .cjs usa
    // `describe`/`it`/`expect`/`vi` do ambiente e continua sendo CommonJS valido. Os testes de
    // `tests/**/*.test.ts` seguem importando explicitamente — os globais so somam, nao substituem.
    globals: true,
  },
});
