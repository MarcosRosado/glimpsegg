# public/

Assets estáticos servidos pelo Vite na raiz (`/minimap.png`, `/favicon.svg`). Três arquivos, e
os três têm dono diferente: um é arte calibrada, dois são derivados do master de ícone.

## Arquivos

| Arquivo | Origem | Consumido por |
| --- | --- | --- |
| `minimap.png` | **Arte do jogo, colocada à mão.** Nenhum script gera ou valida este arquivo | `src/components/vision/WardMinimapTab.tsx` (`src="./minimap.png"`) |
| `favicon.svg` | Cópia byte a byte de `build/icon.svg`, feita por `npm run icons:generate` | `index.html` |
| `favicon-32.png` | Cópia de `build/icons/32x32.png`, feita pelo mesmo gerador | `index.html` |

## Regras locais

- **Trocar `minimap.png` invalida a calibração.** As constantes `MAP_IMAGE_INSET`,
  `MAP_PLAYABLE_WIDTH_PCT` e `MAP_PLAYABLE_HEIGHT_PCT` de `src/constants/mapGeometry.ts`
  descrevem onde as células 64..192 caem **dentro desta imagem**, em porcentagem. Imagem nova
  com outra margem de arte = todas as wards plotadas fora do lugar, sem erro nenhum na tela.
  `tests/utils/minimapCoords.test.ts` é o que transforma isso em teste vermelho.
- A recalibração está documentada no topo do `mapGeometry.ts`: ancorar primeiro nas duas runas
  de **bounty** da jungle e depois nas de poder, manter o span igual nos dois eixos, e **não**
  usar a borda da arte como referência. A primeira versão esticava 64..192 de borda a borda e
  errava até 4,5% da largura do mapa — visível a olho nu.
- **`favicon.svg` e `favicon-32.png` são gerados: não editar aqui.** Mexer neles direto faz
  `npm run icons:check` falhar no CI, porque o sha256 deixa de bater com
  `build/icons.manifest.json`. O que se edita é `build/icon.svg`.
- Este diretório é copiado cru para `dist/`. Nada aqui passa por bundling, hash de conteúdo ou
  tree-shaking — arquivo grande esquecido aqui vai inteiro para o AppImage.

## Ao sair um patch

`minimap.png` é o único asset do app que envelhece com o jogo: mudança de terreno (nova
posição de campo neutro, rio redesenhado) deixa a arte desatualizada mesmo com a calibração
intacta. Trocar a imagem obriga a refazer `MAP_IMAGE_INSET` contra as âncoras de runa e rodar
`npx vitest run tests/utils/minimapCoords.test.ts`. Os dois favicons não mudam por patch de Dota
— são marca, não conteúdo do jogo.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../build/CLAUDE.md](../build/CLAUDE.md) ·
[../scripts/CLAUDE.md](../scripts/CLAUDE.md) ·
[docs/PATCH-CHECKLIST.md](../docs/PATCH-CHECKLIST.md)
