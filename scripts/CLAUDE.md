# scripts/

Ferramentas de manutenção que rodam **fora** do app: nada aqui é importado pelo bundle. Duas
geram artefato commitado (ícones, catálogo de itens) e duas são operacionais.

## Arquivos

| Arquivo | Como rodar | O que faz |
| --- | --- | --- |
| `generate-glimpse-icons.cjs` | `npm run icons:generate` / `npm run icons:check` | Rasteriza `build/icon.svg` nos 8 tamanhos, monta `build/icon.ico`, copia `public/favicon.svg` e `public/favicon-32.png`, e grava `build/icons.manifest.json`. O `--check` só compara sha256 |
| `sync-items-full.cjs` | `node scripts/sync-items-full.cjs` (sem script npm) | Funde três camadas — o `items.ts` atual, a OpenDota (`constants/item_ids` + `constants/items`) e o datafeed da Valve (`itemlist` + `itemdata` por id), que vence — e **regrava `src/constants/items.ts`** inteiro, incluindo `getItem` e `isNeutralItem`. Imprime o diff (novos, custo, tier) |
| `check-patch-readiness.cjs` | `node scripts/check-patch-readiness.cjs` | Só leitura: diz se Valve, OpenDota e STRATZ já viraram para o patch (constantes `PATCH`, `NEW_ITEM_IDS`, `REMOVED_ITEM_IDS` no topo, editar a cada patch). Lê o token do `stratz_app_config.json` do app e **nunca o imprime** — a saída pode ser colada em qualquer lugar |
| `build-and-deploy-local.sh` | `./scripts/build-and-deploy-local.sh` | Pipeline local de AppImage: `icons:generate` → `npm run build` → `electron-builder --linux AppImage` → instala em `~/AppImages/` no formato do Gear Lever e reescreve os atalhos `.desktop` |
| `sanitize-git-repo.sh` | `./scripts/sanitize-git-repo.sh` | Cria um branch órfão `main` com um único commit inicial, para publicar sem histórico contendo token ou ID pessoal. Pede confirmação e reconfigura o `origin` |

## Regras locais

- **O CI não gera ícones.** O que está commitado é o que a release publica; `icons:check` existe
  para transformar "esqueci de regenerar" em erro vermelho. Editou `build/icon.svg`? Rode o
  gerador e **commite os binários junto**.
- Duas restrições de preflight no gerador, ambas por bug silencioso: nada de `<text>` no master
  (a fonte que o fontconfig resolve varia por máquina — texto vira `<path>`), e ImageMagick
  precisa do delegate **RSVG**, senão o renderizador MSVG interno ignora gradientes e filtros e
  destrói o ícone sem erro. Cada PNG ainda é conferido com `identify` contra
  `<size> <size> 8`, e o `.ico` contra a contagem de camadas.
- O sha256 dos masters `.svg` é calculado com `\r\n` normalizado — checkout no Windows mudaria
  o hash do mesmo conteúdo e o gate acusaria diferença que não existe.
- `sync-items-full.cjs` **escreve por cima**: edição manual de nome, custo ou tier em
  `src/constants/items.ts` se perde na próxima execução, porque a Valve vence. O catálogo atual
  só serve de base para o id que nenhuma fonte lista mais (item removido do jogo). Ele resolve o
  caminho relativo ao diretório de trabalho — rodar da raiz do repo. São ~570 requisições ao
  datafeed (uma por item, para o custo); leva cerca de um minuto. Se a Valve falhar o script
  aborta sem tocar no arquivo; se a OpenDota falhar, segue sem ela.
- `build-and-deploy-local.sh` tem `/home/Reider/AppImages` e o diretório da Área de trabalho
  **cravados**: é script da máquina do autor, não pipeline portátil. Ele sempre regenera os
  ícones — a guarda anterior só testava se os arquivos existiam, então editar o SVG nunca
  disparava a regeneração e o deploy saía com a arte antiga.
- `sanitize-git-repo.sh` **reescreve histórico** e roda `git branch -D main`. Não é utilitário
  do dia a dia.

## Ao sair um patch

`sync-items-full.cjs` é o caminho oficial para item novo: rodar, conferir o diff de
`src/constants/items.ts` e commitar. Herói novo **não** passa por aqui —
`src/constants/heroes.ts` não tem gerador e é editado à mão. Os outros três scripts não
conhecem conteúdo de Dota. Roteiro completo em
[docs/PATCH-CHECKLIST.md](../docs/PATCH-CHECKLIST.md).

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../build/CLAUDE.md](../build/CLAUDE.md) ·
[../public/CLAUDE.md](../public/CLAUDE.md)
