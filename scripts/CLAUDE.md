# scripts/

Ferramentas de manutenção que rodam **fora** do app: nada aqui é importado pelo bundle. Duas
geram artefato commitado (ícones, catálogo de itens), duas são operacionais e onze são a
**medição e a coleta do plano de saída da STRATZ** de [docs/PLANO-OPENDOTA.md](../docs/PLANO-OPENDOTA.md).

## Arquivos

| Arquivo | Como rodar | O que faz |
| --- | --- | --- |
| `generate-glimpse-icons.cjs` | `npm run icons:generate` / `npm run icons:check` | Rasteriza `build/icon.svg` nos 8 tamanhos, monta `build/icon.ico`, copia `public/favicon.svg` e `public/favicon-32.png`, e grava `build/icons.manifest.json`. O `--check` só compara sha256 |
| `sync-items-full.cjs` | `node scripts/sync-items-full.cjs` (sem script npm) | Funde três camadas — o `items.ts` atual, a OpenDota (`constants/item_ids` + `constants/items`) e o datafeed da Valve (`itemlist` + `itemdata` por id), que vence — e **regrava `src/constants/items.ts`** inteiro, incluindo `getItem` e `isNeutralItem`. Imprime o diff (novos, custo, tier) |
| `check-patch-readiness.cjs` | `node scripts/check-patch-readiness.cjs` | Só leitura: diz se Valve, OpenDota e STRATZ já viraram para o patch (constantes `PATCH`, `NEW_ITEM_IDS`, `REMOVED_ITEM_IDS` no topo, editar a cada patch). Lê o token do `stratz_app_config.json` do app e **nunca o imprime** — a saída pode ser colada em qualquer lugar |
| `compare-sources.cjs` | `node scripts/compare-sources.cjs [collect [conta ...]]` | OpenDota × STRATZ nas mesmas partidas: posição, direção de rota, IMP, fatia de dano físico, contagem de mortes e wards — a tabela do §1 do plano — mais a concordância campo a campo que alimenta o aceite da Fase 1. Sem `collect` só relata, offline, sobre o arquivo passado ou o `.gabarito/pairs-*.json` mais recente |
| `sample-control.cjs` | `node scripts/sample-control.cjs [collect]` | Controle e slow **sofridos** por jogador (só a STRATZ mede): distribuição e taxa de disparo por limiar. Sem `collect` só relata, sobre o arquivo passado ou o `.gabarito/control-sample-*.json` mais recente |
| `snapshot-hero-stats.cjs` | `node scripts/snapshot-hero-stats.cjs [--status] [--retry-empty]` | Fotografia de `heroStats.stats`: herói × posição × faixa × minuto, com `matchCount`, em `.gabarito/hero-stats/<data>/`. Retoma do manifesto |
| `collect-pairs.cjs` | `node scripts/collect-pairs.cjs [--lane 7.41] [--before id] [--limit N] [--no-volume] [--status]` | O coletor diário (roteiro em [docs/COLETA-GABARITO.md](../docs/COLETA-GABARITO.md)). Numa passada sobre `/parsedMatches` grava **pares** rotulados estratificados em `.gabarito/pairs/` (`{ od, st, gen }`; 5 faixas de ranque × 3 de duração, por patch, uma trilha por patch) e **volume** só-OpenDota em `.gabarito/matches/` (a base da Fase 2). Para sozinho no limite diário da OpenDota e retoma; uma instância por vez |
| `probe-imp-generator.cjs` | `node scripts/probe-imp-generator.cjs <matchId>` | Acha `matchGenerator` no schema por busca a partir da raiz (hoje `stratz.page.imp.matchGenerator`), monta a seleção por introspecção e guarda a resposta em `.gabarito/` |
| `accept-phase1.cjs` | `node scripts/accept-phase1.cjs [--all] [dir]` | **Aceite da Fase 1.** Roda o `mapOpenDotaMatch` de verdade sobre a metade OpenDota de cada par e compara a **saída do mapper** com a STRATZ: KDA, itens, patrimônio, wards, mortes e posição, por faixa de ranque e por duração. Offline, sem token. Sai com código 1 se o critério não passa |
| `build-benchmarks.cjs` | `node scripts/build-benchmarks.cjs [--show heroi:pos]` | **Agregador da Fase 2.** Da base em disco (pares + volume) para curvas cumulativas por minuto (0 a 60) com n, média, p25, p50 e p75, em dois níveis: herói × posição e herói × core/suporte. Grava `.gabarito/benchmarks/<patch>.json`, **regravado** a cada execução (é derivado). Só célula com 200+ linhas sai `sufficient`. Offline, sem token |
| `fit-glint-experimental.cjs` | `node scripts/fit-glint-experimental.cjs [--json]` | **Ajuste do Glint experimental** (a nota de impacto do app). Regressão dos percentis da OpenDota contra o IMP nos pares: treino em 7.41, teste em 7.42. Imprime métricas, os pesos para colar em `src/utils/glint.ts` e a tabela de limiares por quantil. Offline, sem token |
| `fit-lane-verdict.cjs` | `node scripts/fit-lane-verdict.cjs [--json]` | **Ajuste do veredito de rota próprio (Fase 3).** Patrimônio e xp aos 10 min de quem estava na rota, com o mesmo peso (o xp é **decisão do dono**, D1 — as variantes só de patrimônio saíram da lista); a agregação (soma ou média por herói) e a diferença (relativa ou absoluta) são escolhidas **só em 7.41**; a linha de base só-patrimônio segue impressa; limiares por taxa de disparo (empate 25%, atropelo 10%); aceite em 7.41 e 7.42 pelo limite inferior do IC95 de Wilson, com cobertura ao lado; estratos e a conferência do campo `lane`. Termina carregando `src/utils/laneVerdict.ts` pelo `runnerImport` e conferindo, rota a rota, que a função do app reproduz a regra medida. Imprime o bloco de `LANE_VERDICT_MODEL`. Offline, sem token |
| `collect-daily.sh` | agendado (systemd de usuário, 15h) ou `GABARITO_UNTIL=AAAA-MM-DD ./scripts/collect-daily.sh` | A rotina diária inteira sem ninguém: trilha 7.41 até metade da cota, trilha 7.42, aceite e critério de corte, com log em `.gabarito/logs/`. Exige data de fim e tem teto de duração — ver [docs/COLETA-GABARITO.md](../docs/COLETA-GABARITO.md) |
| `benchmark-coverage.cjs` | `node scripts/benchmark-coverage.cjs [--history] [--no-log] [--min-cell N]` | **Critério de corte contínuo da Fase 2.** Sobre pares + volume: fatia das linhas de jogador em célula herói × posição (e herói × core/suporte) com 200+ linhas, por patch, e a curva própria de patrimônio e cs contra a fotografia da STRATZ. Cada execução grava uma linha em `.gabarito/coverage-log.jsonl`. Offline, sem token |
| `lib/sources.cjs` | (importado pelos cinco que falam com a STRATZ) | Token da STRATZ, as duas APIs, introspecção e o diretório `.gabarito/` |
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
  aborta sem tocar no arquivo; se a OpenDota falhar, segue sem ela. Id que a OpenDota lista em
  `item_ids` mas não descreve em `constants/items` é **ignorado e impresso**: são ~100, quase
  todos já cobertos pela Valve ou pelo catálogo, e os que sobram são talento e invocação, não
  item — o merge fabricava para eles nome, `isNeutral: true` e uma imagem 404.
- **`.gabarito/` é régua interna e está no `.gitignore`** (decisão D5 do plano): pares, fotografia
  e amostras nunca entram no repositório nem no app. Os scripts de medição resolvem esse
  diretório a partir do diretório de trabalho — rodar da raiz.
- **Coleta nunca sobrescreve coleta.** `compare-sources.cjs collect` e `sample-control.cjs collect`
  gravam arquivo novo e datado e não gravam resultado vazio. `pairs-2026-11-19.json` e
  `control-sample-2026-11-19.json` são as amostras que produziram os números do plano, e a
  STRATZ pode não responder de novo — não apagar.
- **Os scripts de medição nunca imprimem o token**, pela mesma regra do
  `check-patch-readiness.cjs`: de uma resposta que falhou só sai o status HTTP ou a mensagem do
  GraphQL, nunca o corpo. A leitura do token mora só em `lib/sources.cjs`.
- **Os coletores gastam cota.** Sem chave a OpenDota dá 3.000 chamadas por dia e 60 por minuto;
  `collect-pairs.cjs` lê o saldo nos cabeçalhos e para com 150 de reserva. Os relatórios
  (`compare-sources.cjs` e `sample-control.cjs` sem `collect`, os `--status`, o
  `accept-phase1.cjs`, o `benchmark-coverage.cjs` e o `build-benchmarks.cjs`) não tocam a rede.
- **De uma resposta que falhou sai o status e o texto de `errors[].message` do GraphQL**, cortado,
  e nada mais do corpo. Sem a mensagem, nome de campo errado vira "HTTP 400" mudo — foi o que
  deixou a primeira tentativa de `matchGenerator` sem diagnóstico.
- **Nada de nome de campo, argumento ou caminho de cabeça.** Na primeira execução real
  (2026-11-19) a sonda assumia `Query.imp` e o gerador estava em `stratz.page.imp`; a fotografia
  assumia dois argumentos `groupBy*` que por acaso existiam. Os dois agora leem o schema, e a
  fotografia valida `position`/`time`/`matchCount` na primeira linha — sem isso toda célula
  sairia "vazia", e vazio ali é afirmação.
- **Resposta vazia da STRATZ não é prova de célula vazia.** Na fotografia de 2026-11-19, 11
  células vieram sem linha e voltaram completas ao repetir: rodar `--retry-empty` antes de ler
  qualquer vazio como "sem amostra".
- **`collect-pairs.cjs` faz a triagem da página inteira numa requisição à STRATZ** (cem
  `match(id)` com alias) antes de gastar chamada da OpenDota. A raiz `matches(ids)` seria o
  natural, mas responde `null` com "User is not an admin." — e a primeira versão tratou esse
  `null` como "sem triagem" **em silêncio** e rodou horas no caminho caro (317 de 544 candidatas
  pagas para cair em `modo`). Resposta nula de triagem agora é impressa. Ele valida
  `STRATZ_FIELDS` antes de qualquer chamada, para em 429 ou em 5 erros seguidos, e segura
  4,5 s entre pares pelo limite horário do token.
- **O patch vem da OpenDota, nunca do `gameVersionId` da STRATZ**, que é 190 para 7.41f e para
  7.42. Registro usa o `patch` da partida (60, 61); a triagem usa o horário de início contra a
  data de `/constants/patch`. A cada patch novo: acrescentar o id em `PATCH_BY_OD_ID` (coletor e
  `benchmark-coverage.cjs`) e a data da virada.
- **Um coletor por vez.** `.gabarito/pairs/.lock` guarda o pid; duas instâncias regravariam o
  mesmo `index.json`. Parar com Ctrl+C (SIGINT), que grava o índice — e cuidado com
  `pkill -f collect-pairs`, que casa com o próprio shell que o chamou.
- **Não cravar id real de partida em script.** A partida da fixture `match-parsed-opendota.json`
  foi anonimizada; um id real num arquivo commitado desfaz isso.
- **O token não vem mais de uma tela do app.** O app deixou de usar a STRATZ em 2026-11-19 e não
  pede nem grava token. `lib/sources.cjs` procura, nesta ordem: `STRATZ_API_KEY`, o arquivo
  `.gabarito/.stratz-token` (uma linha, criado à mão pelo dono do token) e, por último, a chave
  `stratzApiKey` que tenha sobrado no `stratz_app_config.json` de uma versão anterior — o app
  não a apaga, mas instalação nova não a tem.
- **Peso e limiar do Glint saem do script, nunca do olho.** `fit-glint-experimental.cjs` é a
  única fonte de `GLINT_MODEL` e `GLINT_THRESHOLDS`; a conversão de limiar é por quantil (mesma
  taxa de disparo do limiar de IMP), porque a regressão comprime a escala.
- **Limiar do veredito de rota também sai do script.** `fit-lane-verdict.cjs` é a única fonte de
  `LANE_VERDICT_MODEL`. As taxas-alvo, a escolha da variante e a régua do aceite estão escritas no
  cabeçalho **antes** de qualquer concordância: alargar o empate sobe a concordância
  mecanicamente (o aceite só conta rotas que as duas fontes decidem), então a faixa é fixada por
  taxa e a cobertura sai sempre ao lado. Se o aceite cair num reajuste, muda o rótulo da tela
  (§5 do plano), nunca o limiar para fazer passar.
- **O coletor muda os pares por baixo.** Com `collect-pairs.cjs` rodando, duas execuções
  seguidas de um ajuste leem conjuntos diferentes (561 → 564 pares em minutos, em 2026-11-19).
  Para colar um bloco, congele um retrato: diretório com `.gabarito/pairs/` de links simbólicos
  para os arquivos do momento (mais o `index.json`) e rode os dois modos do script de dentro dele.
- **`accept-phase1.cjs` não copia o mapper**: carrega `src/services/openDotaMatch.ts` pelo
  `runnerImport` do Vite (o Node não resolve os imports sem extensão). Uma segunda implementação
  em `.cjs` passaria no aceite medindo a si mesma. Campo que a STRATZ não devolveu sai do
  denominador e é contado à parte; o script nunca ajusta nada para passar.
- **Mexer em `STRATZ_FIELDS` depois de começar a coleta** deixa par antigo sem o campo novo. O
  aceite tira esses pares do denominador ("sem gabarito"); o certo é completar pela STRATZ por id.
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
