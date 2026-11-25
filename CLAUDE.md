# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

GlimpseGG é um app desktop (Electron + React 19 + TypeScript + Vite 8) de análise pós-jogo de
Dota 2. É um **cliente puro**: não existe backend, banco nem telemetria. Fala só com
`api.opendota.com` (REST, público, sem token) e com fontes da Valve.

**A STRATZ saiu do app em 2026-11-19.** Nenhuma tela, hook ou serviço em uso fala com ela, e o
app não pede nem guarda token: basta o Steam ID. O que só ela calculava ficou **escondido** até
existir substituto aceito (coaching por minuto contra a média do herói, recomendação de build),
com uma exceção assumida — a nota de impacto, que entrou como **Glint experimental**. O veredito
de rota voltou no mesmo dia, com **regra própria** e aceite medido (Fase 3). O plano inteiro,
com o que cada fase devolve, está em [`docs/PLANO-OPENDOTA.md`](docs/PLANO-OPENDOTA.md). O código
da STRATZ saiu por completo do app (etapa 2: `stratzGql.ts` e a fixture `match-parsed.json`
apagados); ela só é consultada pelos scripts de `scripts/`, como gabarito de medição — rotina em
[`docs/COLETA-GABARITO.md`](docs/COLETA-GABARITO.md).

Convenção de idioma: documentação, comentários e mensagens de commit em pt-BR; identificadores de
código em inglês. Os comentários existentes explicam *por que* algo é assim, muitas vezes citando o
bug que a decisão substituiu — vale ler antes de "simplificar" um trecho.

**A exceção é o README**, que é a porta de entrada do repositório e por isso tem o inglês como
padrão: `README.md` em en-US e `README.pt-BR.md` em pt-BR, com link de idioma no topo dos dois.
Os dois são espelho um do outro — mudança de conteúdo entra nos **dois**, ou eles divergem em
silêncio (é o mesmo risco dos dois dicionários de `i18n/`, sem gate automático que o pegue).
Todo o resto da documentação, `CLAUDE.md` e `docs/` inclusive, segue em pt-BR.

## Mapa de pastas

Cada pasta com mais de um arquivo tem um `CLAUDE.md` próprio: o que mora ali, quem consome, as
armadilhas locais e uma seção **"Ao sair um patch"**. Este arquivo guarda a doutrina; os de pasta
guardam a localização.

| Camada | Onde |
| --- | --- |
| Renderer | [`src/`](src/CLAUDE.md) · [`components/`](src/components/CLAUDE.md) ([dashboard](src/components/dashboard/CLAUDE.md) · [match](src/components/match/CLAUDE.md) · [heroGrid](src/components/heroGrid/CLAUDE.md) · [layout](src/components/layout/CLAUDE.md) · [ui](src/components/ui/CLAUDE.md) · [brand](src/components/brand/CLAUDE.md)) |
| Rede e cache | [`services/`](src/services/CLAUDE.md) · [`services/heroGrid/`](src/services/heroGrid/CLAUDE.md) · [`__fixtures__/`](src/services/__fixtures__/CLAUDE.md) |
| Motores puros | [`utils/`](src/utils/CLAUDE.md) · [`insights/`](src/utils/insights/CLAUDE.md) · [`insights/rules/`](src/utils/insights/rules/CLAUDE.md) · [`utils/heroGrid/`](src/utils/heroGrid/CLAUDE.md) |
| Dados e contratos | [`constants/`](src/constants/CLAUDE.md) · [`types/`](src/types/CLAUDE.md) · [`i18n/`](src/i18n/CLAUDE.md) · [`hooks/`](src/hooks/CLAUDE.md) |
| Processo main | [`electron/`](electron/CLAUDE.md) · [`electron/heroGrid/`](electron/heroGrid/CLAUDE.md) |
| Testes | [`tests/`](tests/CLAUDE.md) — a suíte inteira, espelhando `src/` e `electron/` |
| Ferramentas e arte | [`scripts/`](scripts/CLAUDE.md) · [`public/`](public/CLAUDE.md) · [`build/`](build/CLAUDE.md) |

**Patch novo do Dota:** [`docs/PATCH-CHECKLIST.md`](docs/PATCH-CHECKLIST.md) — a ordem de operação
inteira, com o que se resolve sozinho e o que envelhece em silêncio.

## Comandos

| Comando | Para quê |
| --- | --- |
| `npm run electron:dev` | Dev real: vite + Electron juntos (`concurrently`, espera a porta 5173) |
| `npm run dev` | Só o vite. Sem `window.api`, o app cai no **caminho browser** (fetch direto + `localStorage`) |
| `npm test` | Vitest, uma passada |
| `npm run test:watch` | Vitest em watch |
| `npm run build` | `tsc -b && vite build`. Os gates de tipo moram aqui — ver *Gates* |
| `npx oxlint` | Lint (config em `.oxlintrc.json`; não há script npm) |
| `npm run icons:check` | Compara os ícones commitados com o sha256 dos masters. Roda no CI |
| `npm run icons:generate` | Regenera os ícones a partir de `build/icon.svg` |
| `npm run electron:start` | Roda o bundle de `dist/` em modo produção |
| `npm run electron:test-clean` | Electron com `userData` em `/tmp/glimpsegg-clean-test`. O diretório **persiste** entre execuções: apague-o antes de rodar para testar o onboarding de primeira execução |
| `npm run dist` | AppImage local |

Rodar um teste isolado:

```bash
npx vitest run tests/services/visionMapper.test.ts   # um arquivo
npx vitest run tests/utils/heroGrid/                 # uma pasta
npx vitest run -t "paridade dos dicionarios"         # por nome de describe/it
```

`vitest.config.ts` é separado do `vite.config.ts` de propósito, com `environment: 'node'` e
`include: ['tests/**/*.test.ts', 'tests/**/*.test.cjs']` — **não há ambiente de DOM**. Componentes
`.tsx` não têm teste; a lógica testável foi extraída para funções puras em `src/utils/` e
`src/services/`. Ao mexer em comportamento dentro de um componente, considere extrair a parte pura
para conseguir testar.

**Teste não fica junto do código.** `src/` e `electron/` contêm só o que o app embarca; a suíte
inteira mora em [`tests/`](tests/CLAUDE.md), **espelhando a árvore** — `src/utils/heroGrid/ranking.ts`
é testado por `tests/utils/heroGrid/ranking.test.ts`, e `tests/electron/` espelha `electron/`. As
fixtures são a exceção deliberada: seguem em `src/services/__fixtures__/`, consumidas por import
relativo. `tsconfig.app.json` inclui `["src", "tests"]`, então o `tsc -b` continua checando os testes
`.ts`.

## Os dois caminhos de rede

É a bifurcação mais importante do projeto e ela aparece em todo serviço:

- **Electron** — `electron/preload.cjs` expõe `window.api`; as chamadas vão por IPC para
  `electron/main.cjs`, que faz o fetch no processo main. Config persistida em
  `glimpsegg_config.json` dentro do `userData` (o app só lê e grava o Steam ID, o idioma e as
  preferências). Até a 2.0 o arquivo era `stratz_app_config.json`: no primeiro início a migração
  (`electron/configMigration.cjs`) **copia** tudo menos `stratzApiKey` e deixa o antigo intocado,
  porque os scripts de medição ainda procuram o token lá.
- **Browser** (`npm run dev`) — `window.api` é `undefined`, então o renderer faz `fetch` direto e a
  config vive no `localStorage` (`glimpsegg_steam_id`, `glimpsegg_profile_history`,
  `app_language`; as duas primeiras eram `stratz_*` e são copiadas uma vez por
  `utils/legacyStorage.ts`).

Todo serviço cobre os dois ramos. O padrão é `openDotaGet(endpoint)` em `src/services/opendota.ts`:
uma função, os dois caminhos, `null` em qualquer falha. Código novo de rede passa por ela. Host
novo exige liberação em **três** lugares independentes: a CSP em `vite.config.ts` (só produção —
em dev não há CSP), a `EXTERNAL_HOST_ALLOWLIST` em `electron/main.cjs` (só para abrir link no
browser do sistema) e um handler IPC. O handler `api:opendota-fetch` é genérico (recebe só o
endpoint), então rota nova de **leitura** da OpenDota não precisa de handler novo; o pedido de
parse (`POST /request/{id}`) tem handler próprio, que só aceita um id numérico.

## Pipeline de dados de partida

`fetchOpenDotaMatchDetails(matchId)` → `mapOpenDotaMatch(m)` → `MatchDetails`
(`src/services/openDotaMatch.ts`).

`mapOpenDotaMatch` é exportada, pura e testada (`tests/services/openDotaMatch.test.ts`) contra
`src/services/__fixtures__/match-parsed-opendota.json`: uma resposta 200 **real** e anonimizada
de `GET /api/matches/{id}`, de partida parseada (e `match-uneven-lane-opendota.json`, segunda
partida real, escolhida pelo que dispara). Use essas fixtures ao mexer em parsing em vez de
montar objeto sintético à mão, e não as substitua por dado inventado. O cabeçalho do mapper
lista o que a OpenDota **não** tem e sai **desligado, não aproximado**: `availability.imp`,
`heroAverage`, `abilities` e `damageReport` são `false`. `laneOutcomes` não vem da OpenDota:
sai da regra própria de `utils/laneVerdict.ts`.

**Partida não parseada é o caso comum.** A STRATZ parseava sozinha; a OpenDota parseia a pedido.
Sem parse a partida abre só com o placar (`availability.parsePending`), no "modo placar", e o
`ParseRequestCard` oferece "Analisar replay". O pedido sai **só no clique** — cada um conta como 10 chamadas
no limite da OpenDota — e a espera consulta a **partida**, não o job (`GET /request/{jobId}`
devolve `null` tanto para "terminou" quanto para "não existe"), com recuo e teto de ~5 minutos.

**A dashboard** vem de `src/services/openDotaProfile.ts`: perfil, vitórias, 40 partidas recentes,
companheiros e heróis mais jogados. O cabeçalho dele lista o que a **lista de partidas** não tem
(veredito de rota, posição, prêmio, participação em abates, patrimônio final) e fica ausente. Os
heróis mais jogados são contados na lista completa de partidas, não em `/players/{id}/heroes`:
essa rota devolvia `games: 0` para os 127 heróis de uma conta com 2.870 partidas, e a fixture
`opendota-player.json` guarda a prova.

**Os testes de motor rodam sobre a OpenDota.** `tests/support/fixtureMatches.ts` entrega as duas
partidas reais pelo mapper real; o que só a STRATZ tinha (curva `heroAverage`, divisão
físico/mágico/puro, controle sofrido, marcas forenses de morte) entra por sobreposição de
domínio **com `Synthetic` no nome**, para cobrir as regras dormentes até a Fase 2 religá-las.
Nenhum número dessas sobreposições foi copiado da STRATZ, e `placeholders.test.ts` lista à mão
as regras sem disparo — perda de cobertura vira teste vermelho, não silêncio.

Falha de rede ou de parsing devolve `null`, e o `App` mostra toast. **Não existe fallback para dados
fabricados** — o antigo `src/services/mockData.ts` foi removido de propósito, porque ele fazia a tela
abrir com a partida errada em vez de avisar.

`src/App.tsx` é o orquestrador: guarda a conta, perfil atual, histórico de perfis, partida
selecionada, slot selecionado e aba ativa; monta a moldura da 2.0 (barra lateral com Início,
Partidas, Heróis, Conta e o hero grid; topo com conta, patch e busca) e a partida em duas formas:
sem análise, o "modo placar" sem abas; analisada, as abas Resumo, Meu jogo, Lutas, Visão e
Coaching com um seletor de jogador só. Detalhe em [`src/CLAUDE.md`](src/CLAUDE.md).

## A doutrina central: nunca inventar dado

Boa parte do desenho do projeto existe para isso. Três mecanismos, todos tipados:

1. **`MatchDataAvailability`** (`types/dota.ts`) — 15 flags (`parsed`, `perMinuteStats`,
   `deathEvents`, `wards`, `heroAverage`, `laneOutcomes`, `imp`, `glint`, `parsePending`,
   `teamfights`, `objectives`…). Regra de
   coaching ou seção de UI que exija uma flag ausente é **pulada**, não estimada.
2. **`BenchmarkSource`** — `HERO_AVERAGE` | `HERO_STATS` | `MATCH_ONLY` | `ROLE_BASELINE`. Todo
   número de comparação carrega procedência e `sampleSize`, e a UI renderiza isso como chip.
   `ROLE_BASELINE` é constante estática e **precisa** aparecer rotulado como estimativa.
3. **`ResolvedBracket.isPlayerSpecific`** (`utils/rankBracket.ts`) — quando o bracket cai em `ALL`,
   a UI não pode dizer "no seu rank"; tem de dizer "média geral". É regra de honestidade.

Quando faltar dado, as saídas legítimas são esconder a seção ou marcar a procedência. Preencher
lacuna com estimativa não rotulada é regressão, mesmo que a tela fique mais bonita. Precisar de uma
condição nova de disponibilidade → adicionar flag em `MatchDataAvailability`.

**Veredito de rota vem só de dado dos 10 primeiros minutos de quem estava na rota.** Desde
2026-11-19 a fonte é a regra própria de `utils/laneVerdict.ts` (Fase 3, D1): patrimônio **e xp**
aos 10 min, média por herói de cada lado, diferença relativa de cada um, e o score é a média das
duas, com o mesmo peso — o xp entrou por **decisão do dono** ("o XP é tão importante quanto o
patrimônio"), não por ganhar no dado. Limiares fixados por **taxa de disparo** (empate = 25% das
rotas, atropelo = 10%). "Quem estava na rota" é o campo geográfico `lane` da OpenDota (1 bot,
2 mid, 3 top), sem conversão safe/off; patrimônio ou xp faltando em qualquer jogador da rota a
deixa sem medida. Aceite medido contra a STRATZ: direção igual em 98,8% das rotas de 7.42 em que
as duas dizem que alguém venceu (IC95 97,9–99,3%, n=1.011), 98,7% em 7.41. **Rota desigual** (2v1,
1v2) não passou (74,4% no treino) e nunca vira "Lane vencida": sai `UNKNOWN` com "Vantagem aos
10 min" e as diferenças **por herói** ao lado (`laneAdvantage.kind = 'ADVANTAGE'`), com o lado
dado pelo score da regra. O veredito mostra a própria base: o badge leva **as duas** diferenças
da rota (patrimônio e xp — só o ouro deixaria "ouro à frente" ao lado de "Lane perdida" quando o
xp decidiu) e o tooltip, a regra e a concordância. Limiar sai de
`scripts/fit-lane-verdict.cjs`, nunca do olho — e o script confere, rota a rota, que a função
do app reproduz a regra medida. IMP, KDA, mortes, last hits e vitória/derrota medem a
**partida inteira** e não podem receber rótulo de rota — `resolvePlayerLaneResult` recebe
exatamente três coisas (rota, lado, outcomes) e nenhum sinal de resultado de partida, de
propósito. A dashboard mantinha um segundo
sistema, paralelo ao do detalhe da partida, que decidia rota por `deaths >= 7 && !isVictory`: uma
safelane atropelada que perdeu o jogo depois saía como "Rota Difícil", e `WIN_LANE` exigia `isWin`,
então ganhar a rota e perder o jogo era **impossível** de rotular. Sem medida (partida não
parseada, série curta, lado vazio) o veredito é `UNKNOWN` e a UI **omite a seção** —
`utils/laneResult.ts` concentra o rótulo, o `hasLaneVerdict` e o `laneVerdictView`. A lista de
partidas ainda não tem badge de rota (vem de `/players/{id}/matches`, sem série por minuto). `MatchDynamicType` é sobre a forma da partida
(`STOMP`/`COMEBACK`/`HIGH_IMPACT`/…), nunca sobre rota.

**Janela importa tanto quanto procedência.** Métrica rotulada como de rota tem de vir dos 10
primeiros minutos: `cs10`/`dn10` somam os deltas, `gold10` lê o array cumulativo. O eixo "Fase de
Rotas" do radar é `null` sem série por minuto (antes caía em `goldPerMinute` do jogo inteiro), e
`kills10`/`deaths10` saem dos eventos reais de morte — eram literais `0` que a tela exibia como
medição.

**Comparar unidades iguais.** `heroAverage` não expõe campo de ouro, então o benchmark de economia
é patrimônio/min contra patrimônio/min (`benchmarks.networthPerMin`), medido no mesmo minuto nas
duas pontas. A versão anterior comparava `goldPerMinute` (ouro ganho) com `networth/min` (ouro
acumulado): na fixture real, 4 dos 10 jogadores estouravam o gatilho de elogio só pelo erro, e o
lado "abaixo da média" nunca disparava. Não existe fallback para `ROLE_BASELINES.gpm` aqui — cair
nele reintroduziria a mistura.

## Glint experimental (`src/utils/glint.ts`)

A nota de impacto do app, de 0 a 100. É uma **regressão linear sobre oito percentis da OpenDota**
(onde o jogador ficou em cada estatística entre partidas do mesmo herói — partida inteira, todos
os ranques) mais um **termo de duração** e um **deslocamento por posição**. **Desde a v5 (no ar
em 2026-11-22) o alvo não é mais o IMP da STRATZ** (D8): os pesos reproduzem a referência de
**contribuição para a vitória** (probabilidade de vitória atribuída por evento,
`scripts/lib/impact.cjs`), com a régua própria de
[`docs/PROPOSTA-REGUA-GLINT.md`](docs/PROPOSTA-REGUA-GLINT.md). A medida oficial da v5 (2.555
partidas novas, 2026-11-23) deu R5 0,52 contra 0,39 do KDA e passou R1–R4 e R9 no detalhe, mas a
lista falhou R1 (meio alto demais) e por isso R8. **O dono manteve a v5** e, em 2026-11-24, pôs no
ar o **ajuste fino v5.1**: os mesmos pesos, mais um deslocamento por posição que dá à nota a mesma
média em toda posição (o alvo já desconta a média da posição). Conferência em 2.555 partidas que o
ajuste fino viu: Spearman 0,53 no detalhe e 0,48 na lista (o KDA dá 0,39), lista × detalhe r 0,973,
correlação com a duração 0,00. **A v5.1 entrou por decisão do dono antes da medida dela**, e a
medida saiu no mesmo dia (log de 2026-11-24, 2.416 partidas de 7.42 fora dos três
congelamentos): **passou** R1–R5, R8 e R9 nos dois caminhos, R5 0,519 no detalhe e 0,467 na lista
contra 0,377 do KDA, lista × detalhe r 0,973. **A v5.1 fica.** As partidas são de antes da 7.42a
(a trilha desce a partir do cursor), então a medida não diz nada sobre ela; desde 2026-11-25 a
rotina colhe a 7.42a e mede a v5.1 só nela (`docs/COLETA-GABARITO.md`, "Trilha 7.42a"). É o que
"experimental" quer dizer, e o rótulo não é enfeite:

- **Todo número de Glint sai com a procedência.** O `GlintBadge` (`components/ui/`) carrega o
  tooltip com as métricas da conferência (`GLINT_MODEL.check`); quem mostra a nota fora dele usa
  `useGlintHint()`. Nota sem rótulo de experimental é regressão.
- **Centro é 50 por construção, mas não é "esperado para herói e posição".** A escala de tela leva
  a mediana a 50 e o p10–p90 a 48 pontos; o percentil é por herói, não por posição nem por ranque,
  e a mediana por posição fica entre 46 e 53 na lista e entre 48 e 52 no detalhe (medida oficial
  da v5.1).
- **Sem composição no tooltip.** Os pesos são todos não negativos (R9), mas as oito métricas andam
  juntas; "puxado por farm" seria causa inventada.
- **Percentil ou duração faltando ⇒ `null`**, e a nota some daquela linha. Nunca `0`. O termo de
  duração existe porque o percentil é por herói em qualquer duração e partida longa infla taxa
  por minuto (critério R3); sem ele, a nota seria outra.
- **Sem posição (lista de partidas, partida não parseada)** a nota é a do detalhe **esperada para o
  herói** pelas cinco posições: fatia de cada posição × (nota do papel + deslocamento da posição)
  (`heroPositionShare`, medida no treino, 127 heróis). Herói fora da tabela usa os pesos sem papel.
  Defeito conhecido: o suporte de herói misto sai ~3 pontos abaixo do detalhe (os pesos de core
  aplicados ao jogo de suporte); corrigir pediria inferir a posição, que é modelo novo.
- **Limiar sai por taxa de disparo**, nunca somando ou convertendo de outra escala:
  `GLINT_THRESHOLDS` traz ao lado a taxa medida de cada um (alvos de 1% nos extremos a 50% no
  neutro).
- **Peso e limiar saem de `scripts/fit-glint-experimental.cjs`** (`--target contrib` para um
  reajuste, `--refine` para o ajuste fino sobre um candidato travado), nunca do olho.
  Modelo novo só entra depois de passar na régua em partidas nunca vistas — congelar a lista de
  partidas já olhadas **antes** de olhar. O modelo antigo, ajustado ao IMP (r 0,81 contra o IMP
  em 469 partidas de 7.42), está em `.gabarito/glint-imp-fit-2026-11-19.json` e a rotina ainda o
  mede, para o registro. O roteiro está no plano, seção "Glint: o que fazer quando as partidas
  novas chegarem".

No detalhe da partida os percentis vêm prontos (`players[].benchmarks`); na lista de partidas
saem dos totais crus mais a tabela pública `GET /benchmarks?hero_id=` (uma chamada por herói, com
cache de 7 dias por patch), e batem com os da partida com diferença mediana de 0,002 a 0,003.
Mortes entram invertidas na tabela — o `pct` da partida já é "menos morte = melhor".

O IMP não existe mais no app. `player.imp` fica `0` (detalhe) ou `null` (lista) como marcador,
e `availability.imp` é sempre `false`; `formatImp*`, `ImpBadge`, `calculateCustomImp` e a escala
`IMP` do `awardEngine` saíram junto com o mapper da STRATZ.

## Destaques da partida (`src/utils/awardEngine.ts`)

Mesma separacao do motor de coaching: **o motor devolve `AwardId` + numero cru**, e texto e
cor vivem na UI (`AWARD_LABEL`/`AWARD_STYLE` em `TeamOverviewCard`). Antes, `title`, `subtitle` e
a classe Tailwind eram literais dentro do engine — e literais **em pt-BR**, entao a versao en-US
exibia "Desempenho lendario com impacto decisivo".

**Superlativo exige margem.** `sortedByImp[0]` coroava alguem em toda partida, inclusive num
empate de dez — "o primeiro de uma lista" nao é destaque. Cada superlativo tem margem e piso
**proprios da metrica**, calibrados sobre 60 partidas reais: a mediana da vantagem do 1º sobre o
2º é 11% em assistencias e 202% em cura, entao um limiar unico ou premiaria cura sempre ou nunca
premiaria assistencia. Lista vazia é resultado valido.

**A nota dos premios de papel tem escala declarada.** `resolveScoreKind` devolve `GLINT` (algum
jogador com nota numerica) ou `null`. Com `null` — partida sem percentis, ou jogador montado sem
o campo `glint` — `TOP_CORE`, `TOP_SUPPORT`, `ROUGH_GAME` e o melhor por posicao sao
**omitidos**: ordenar por uma nota que nao existe coroava o primeiro da lista (era o que o ramo
`IMP`, removido na etapa 2, fazia com `imp: 0` em todos). O MVP sobrevive se alguem do time
vencedor liderou categoria (unidade `NONE`, a UI mostra so o `basis`). O texto abaixo fala em
IMP porque foi escrito e calibrado com ele; onde diz IMP, hoje leia "a nota da partida".

**Tres slots sao fixos: MVP, melhor core e melhor suporte.** Sao os unicos premios sem
exigencia de margem — toda partida tem cores e suportes, e "o core de maior IMP desta partida" e
fato mesmo num placar apertado. O IMP aparece ao lado, entao quem le percebe sozinho quando a
diferenca foi minima, e "melhor suporte" com IMP negativo e uma leitura valida da partida.
`ROUGH_GAME` e os superlativos **continuam** exigindo margem: aqueles afirmam destaque, e o
primeiro de uma lista empatada nao e destaque.

**MVP nao sai do IMP.** IMP mede desempenho contra a *expectativa* do heroi/posicao/ranque, nao
impacto na partida: na amostra, o maior IMP esta no time **perdedor** em 19% dos jogos. Caso real
(8973449942): o carry vencedor fechou 21/5/13 com maior patrimonio, dano e dano em torres, e
levou IMP -10, enquanto um suporte 2/6/20 do time derrotado levou +24. O MVP e o jogador do time
vencedor que leva **mais superlativos**, com IMP so no desempate (e o IMP como criterio
quando ninguem do time vencedor liderou categoria alguma). Ja `TOP_CORE`/`TOP_SUPPORT`
continuam saindo do IMP de proposito — eles perguntam "quem jogou melhor NA FUNCAO", que é
exatamente o que o IMP mede.

**Numero sem metrica nao informa.** O card mostrava `Sufocador · Lifestealer · 27` — tres
campos soltos, e o `27` sem dizer 27 de que. Todo valor sai por um template de i18n
(`AWARD_VALUE`), entao vira "27 denies" / "19,6k de dano em torres" e cada idioma escolhe ordem e
substantivo. Pelo mesmo motivo o premio de papel carrega `basis`: as categorias que elegeram o
jogador. "MVP · 1 superlativo" nao diz nada; "MVP · Carrasco" diz que ele fez mais abates. E todo
selo tem tooltip (`AWARD_HINT`) com o criterio — apelido sem criterio e enfeite.

**Limiar de tag envelhece em silencio.** O badge de farm da lista de partidas usava
`goldPerMinute >= 750` e passou a disparar em **59%** das partidas (a mediana medida é 835). Os
limiares em `MatchList.tsx` e `awardEngine.ts` carregam a taxa de disparo medida ao lado; alvo de
5% a 15%. Refazer a medicao antes de mexer, nunca ajustar no olho.

## Motor de coaching (`src/utils/insights/`)

Determinístico, sem LLM. Regras declarativas, texto fora da regra:

- `ALL_RULES` (em `index.ts`) reúne os arrays de `rules/*.ts`. Cada `InsightRule` tem `id`,
  `category`, `requires` (flags de availability), `positions` opcional, e
  `evaluate(ctx) => RuleHit | null`. O `RuleHit` traz `magnitude` 0..1, `params` com números
  **crus**, `source` e `sampleSize`.
- **Regras não produzem texto.** `RuleId` mapeia para chaves i18n em `ruleText.ts`; a formatação por
  locale acontece na UI (`CoachingInsightsTab`).
- `rank.ts` converte `magnitude` em score, ordena por severidade real e separa forças de melhorias.
  O corte é por **relevância**, não por cota: `IMPROVEMENT_SCORE_FLOOR` descarta melhoria fraca e
  `MAX_PER_CATEGORY`/`MAX_STRENGTHS`/`MAX_IMPROVEMENTS` limitam o topo. Não existe piso de
  quantidade — lista vazia é resultado válido e correto (a versão anterior inventava três blocos de
  conselho genérico para preencher).
- `compositeBurstNoDispel` é a manchete: quando dispara, suprime as regras de
  `SUPPRESSED_BY_COMPOSITE` para não repetir três versões fracas do mesmo diagnóstico.
- Regra que lança exceção é logada e pulada; não derruba a aba.
- `buildInsightContext` (`context.ts`) monta o `InsightContext`: posição efetiva, benchmarks já
  resolvidos com procedência, estatísticas medidas e normalizadas, mortes, `threat` e `build`.

**Adicionar uma regra toca quatro pontos**, e faltar qualquer um quebra o build ou os testes:
`RuleId` em `insights/types.ts` → entrada em `RULE_TEXT` (`ruleText.ts`) → o array em `rules/` →
as chaves nos **dois** dicionários de `i18n/translations.ts`.

`src/utils/insightsEngine.ts` é apenas um shim de compatibilidade para imports antigos; deve
desaparecer quando não houver mais nenhum.

## Visão e wards

- **Quem monta a visão é o `buildVision` de `openDotaMatch.ts`**: `obs_log`/`sen_log` pareados
  com `*_left_log` por `ehandle` → tempo de vida, autor e deward reais (`source: 'PLAYBACK'`);
  ward sem linha de saída tem fim **estimado** e rotulado (`expiryInferred`); sem log nenhum,
  `source: 'NONE'`. Nunca inventar ward. `src/services/visionMapper.ts` guarda só os helpers
  puros (`wardsBySlot`, `computePlayerVisionStats`, `observerUptimePct`, `emptyVisionData`),
  testados sobre a visão que o mapper real monta das duas fixtures reais, com o uptime
  conferido segundo a segundo contra os `obs_log` crus. O parser da STRATZ que morava ali
  (`buildVisionData`, com fallback para `stats.wards`) saiu em 2026-11-19; o valor
  `PLAYER_STATS` de `VisionSource` ficou sem produtor, e o ramo do `WardMinimapTab` que o
  rotula sai junto com ele.
- Coordenadas: `utils/minimapCoords.ts` + `constants/mapGeometry.ts`. **Quem chama declara o espaço
  de origem; a função nunca infere** — a versão que inferia pela faixa de valores plotava todo o lado
  Radiant errado. Células da STRATZ vão de 64 a 192 (128 unidades de mundo por célula) e o Y cresce
  para o norte, então toda conversão inverte o Y.
- As constantes de calibração estão sustentadas por medições documentadas no topo do
  `mapGeometry.ts` (amostra de 544 wards reais, âncoras de runa) e verificadas em
  `tests/utils/minimapCoords.test.ts`. Não alterar esses números sem refazer a calibração contra
  `public/minimap.png` — trocar a imagem do minimapa invalida `MAP_IMAGE_INSET`.

## Recomendação de build

**Escondida desde 2026-11-19** (decisão D7 do plano). Ela vinha de `itemFullPurchase` e
`heroVsHeroMatchup` da STRATZ, e a OpenDota não tem volume para substituir: os agregados
equivalentes ficam abaixo do `MATCHUP_MIN_SAMPLE` do próprio app. A seção não renderiza e nada
chama a rede; o `CoachingInsightsTab` passa `build: null` ao motor.

`utils/buildAdvisor.ts` continua no repositório, puro e testado, porque é o que a Fase 5 vai
religar quando houver agregado próprio de itens. Ele define "item de build" como "item presente
no conjunto de compras daquele herói/posição/ranque" — por isso não precisa de grafo de
componentes — e usa `wilson.ts` para não deixar amostra pequena virar recomendação confiante.

## i18n

**Como o texto soa** está em [`docs/VOZ.md`](docs/VOZ.md): jargão da comunidade (lane, net worth,
last hits, pos 1–5), frase curta, falar do jogo e não do app. Texto novo passa pelo glossário e
pelo teto de tamanho de lá.

`src/i18n/translations.ts` guarda `pt-BR` e `en-US` num único objeto `as const`, com
`TranslationKey = keyof typeof translations['pt-BR']`. O `t(key, params)` do `LanguageContext`
substitui `{nome}` por valor.

**Nunca montar chave em runtime** (`t(\`prefixo${x}\`)`). Tabela de chave dinâmica deve ser
`Record<..., TranslationKey>` com literais explícitos — é dessa convenção que depende o teste de
chave órfã, que só enxerga literais no código.

## Gates: o que realmente segura o projeto

`tsconfig.app.json` tem `strict: false`. As compensações abaixo são deliberadas e **não devem ser
afrouxadas** — com `strict: false` são praticamente a única rede de tipos disponível:

- `RULE_TEXT: Record<RuleId, RuleTextKeys>` — `RuleId` é união fechada, então regra sem texto,
  chave digitada errado ou chave removida do dicionário fazem `tsc -b` falhar.
- `const _localeParity: Record<TranslationKey, string> = translations['en-US']` no fim de
  `translations.ts` — pega o caso inverso (chave que existe em pt-BR e falta em en-US), que antes
  caía silenciosamente no fallback em runtime.
- `tests/i18n/translations.test.ts` — paridade de chaves, nenhuma entrada vazia, mesmos placeholders
  nas duas locales, e nenhuma chave órfã em `src/`. O guard de órfã varre `collectSources('src')`, e
  desde que a suíte saiu para `tests/` os próprios testes ficaram **fora** desse escopo: antes, chave
  citada só num teste passava no guard; agora não passa mais. A mudança de pasta apertou o gate de
  graça — hoje são zero órfãs entre as 950 chaves.

## Ícones e marca

`build/icon.svg` é o master: todos os PNG, o `.ico` e `public/favicon.svg` são **gerados** dele por
`npm run icons:generate` e **precisam ser commitados junto** — o CI não gera ícones, então um commit
sem eles publica release com arte antiga sem sinal de erro. `npm run icons:check` existe para
transformar isso em erro vermelho.

Duas restrições impostas por preflight no gerador: nada de elemento `<text>` no master (a fonte que
o fontconfig resolve varia por máquina; letras vão como `<path>`) e ImageMagick precisa do delegate
RSVG (sem librsvg o renderizador MSVG interno ignora gradientes e filtros e destrói o ícone sem
erro).

O monograma in-app é outro arquivo, redesenhado à mão na grade de 24px:
`src/components/brand/BrandMark.tsx`. Mexer em um exige revisar o outro.

## Release

Todo push na `main` dispara `.github/workflows/release.yml`: calcula a versão, commita
`chore: release vX [skip ci]`, cria a tag e faz build/publish nas três plataformas. Gates, nessa
ordem: `icons:check` → `npm test` → `npm run build`. Teste vermelho bloqueia a release de propósito.

**A versão sai de `scripts/next-version.cjs`** (testado em `tests/scripts/`): última tag + 1 no
patch, a menos que o `major.minor` do `package.json` seja **maior** que o da tag — aí vale a
versão do `package.json`. Não editar `version` à mão, **com uma exceção**: subir major ou minor,
uma vez, no commit da versão (a 2.0.0 nasce assim, decisão de 2026-11-19, §7 de
[`docs/PROPOSTA-V2.md`](docs/PROPOSTA-V2.md)). Patch editado à mão é ignorado, e `package.json`
menor que a tag nunca faz a versão regredir. Criar a tag à mão não serve: nenhum gatilho roda
sobre tag, e o push seguinte somaria 1 ao patch dela.

**Notas de versão por arquivo.** Se existir `docs/release-notes/v<versão>.md`, a release nasce
com ele como corpo (`--notes-file`); senão, vazia, como sempre foi. As notas precisam estar no
commit que vai para a `main` **antes** do push que gera a versão.

**Quem cria a release é o job `version`, e só ele.** Os três jobs de plataforma rodam em paralelo e
o publisher do electron-builder faz *procura ou cria* — com a release ainda inexistente, dois deles
criavam objetos **diferentes** para a mesma tag. Foi o que aconteceu na v1.0.14: o AppImage e o
`latest-linux.yml` num objeto, mac e Windows no outro, e o auto-updater do Linux ficou sem
manifesto na release marcada como `latest`. Criar a release antes da matriz faz os três
**encontrarem** a mesma e apenas subirem artefatos. Ao mexer no publish, manter essa ordem.

## Metadados estáticos do Dota

`src/constants/heroes.ts`, `items.ts` e `abilities.ts` são tabelas grandes com acesso por
`getHero`/`getItem`/`getHeroAbilities`, que **sempre devolvem fallback** em vez de `undefined` — é o
que permite exibir herói ou item de patch novo sem quebrar a tela. `scripts/sync-items-full.cjs`
regenera o catálogo de itens a partir do datafeed da Valve e das constantes da OpenDota. Herói ou
item novo entra aqui.

`constants/mapGeometry.ts`, `counterItems.ts`, `baselines.ts` e `ranks.ts` são constantes de domínio
com justificativa no comentário de topo; `gameVersion.ts` guarda o patch de fallback.

## Layout espelho de heróis (`hero_grid_config.json`)

A feature escreve no `hero_grid_config.json` da conta Steam local — **arquivo do jogador, trabalho
manual, sem cópia em nenhum outro lugar**, e que o cliente do Dota também reescreve ao sair. Todo o
desenho abaixo existe por causa disso, e não por gosto de arquitetura.

**A estratégia de espelho.** O app **nunca altera** o layout que o jogador escolheu. `configs` é um
array, então o espelho é um **elemento novo** ao lado do dele, com os mesmos grupos, nomes e
coordenadas, e a ordem interna de cada grupo definida pela nota. Origem intocada é invariante
verificada, não intenção: `electron/heroGrid/gridFile.cjs` faz `JSON.parse` do texto que vai ao disco
e compara **por igualdade profunda** o config de origem e **todos** os outros configs com o que leu,
abortando com `SOURCE_MUTATED` antes de gravar. O espelho novo vai para o **fim** do array — a
posição dos layouts do jogador nunca muda.

**Identidade é POSIÇÃO, nunca nome.** O Dota permite dois layouts com o mesmo `config_name`, permite
duas categorias com o mesmo `category_name` (o grid publicado pelo D2PT repete `Best with` sete vezes
num layout só — caso real) e permite renomear a qualquer momento. Preferência guarda `{ index, name }`
com `index` como identidade e `name` como último rótulo visto. Identidade por nome perde o rastro do
espelho num rename e cria um segundo na sincronização seguinte. Se for "simplificar" para buscar por
nome, esse é o bug que volta.

**A fronteira: o main é I/O burro.** `electron/heroGrid/` não sabe o que é winrate, espelho nem
ranking. Ele recebe o **texto já serializado** e grava — backup byte a byte, escrita atômica
(tmp + `fsync` + `rename`), poda de 5 backups, trava de escrita única. A decisão de *o que* escrever
mora em função pura sob `src/utils/heroGrid/` (`mirrorBuilder`, `ranking`, `sourcePrecedence`,
`syncScheduler`, `valveJson`), que o vitest alcança. A exceção deliberada é a **guarda de
imutabilidade**, que roda no main porque é a última linha antes do disco e precisa validar
exatamente os bytes que vão ser gravados, não um objeto que alguém prometeu ter serializado direito.
Foi por causa dela que o `include` do `vitest.config.ts` cobre `.test.cjs` (hoje
`tests/**/*.test.cjs`, em `tests/electron/heroGrid/`) — e `globals: true`, porque o Vitest 4 recusa
`require('vitest')` e um `import` num `.cjs` quebra o parse do oxlint.

**A validação de caminho (`pathGuard.cjs`) é do main, não da ponte.** O renderer manda um `path`; sem
validar, o processo privilegiado gravaria em qualquer arquivo do usuário, com backup e atomicidade e
tudo, o que só deixaria o estrago mais convincente. A ponte em `src/services/heroGrid/` roda do lado
que pode estar errado — ela não é fronteira de confiança.

**Serializador próprio (`valveJson.ts`).** A Valve usa tabs, `[` em linha própria e floats de 6
decimais, e a geometria é float **mesmo valendo inteiro** (`0.000000`). `JSON.stringify` reescreveria
a formatação inteira: passaria na igualdade profunda, mas produziria um arquivo visualmente
"reescrito", corroendo a confiança justamente na feature que promete não tocar no layout do jogador.
O round-trip byte a byte contra uma cópia do arquivo real é teste.

**Duas fixtures, de propósito.** `hero-grid-real.json` é o grid real anonimizado (1 layout, 8 grupos,
catálogo inteiro) e `hero-grid-adverse.json` é o **oposto** dele (3 layouts, dois de nome igual,
categorias de nome repetido, grupo vazio, poucos heróis, `version: 4`, campo desconhecido da Valve).
A segunda é a que importa mais: com um layout só, a invariante "não altere nenhum outro layout" passa
**vazia**.

**O que ficou fora, e por quê** — as três decisões foram tomadas na clarificação de 2026-08-26, e
estão registradas aqui para não voltarem como "melhoria":

- **Recorte por posição.** Não há como inferir a função de um grupo pelo nome (`"Supps principais"`,
  `"offs secundários"`), então o winrate usado é o **geral do herói**, e a tela **tem** de dizer isso
  — a ordem do grupo de suportes não é "melhores suportes".
- **Dota 2 Pro Tracker como fonte.** O que ele publica de forma consumível é *ordem* de meta, sem
  winrate e sem amostra. Não satisfaz a exigência de procedência, então não entra: número que
  influencia a ordem sem trazer fonte e tamanho de amostra é exatamente o que a doutrina proíbe.
- **Autostart, bandeja e modo headless.** "Sincronização em background" significa **dentro do app
  aberto**. Com o app fechado não sincroniza, e a aba mostra **quantos dias** se passaram em vez de
  deixar o espelho envelhecer em silêncio.

**Fonte de meta: só a OpenDota.** A STRATZ era a segunda fonte e saiu em 2026-11-19 — removida
da lista, não deixada falhando, porque fonte que só falha rotularia toda sincronização como
`PARTIAL`. OpenDota respondeu ⇒ `SUCCESS`; OpenDota fora ⇒ `FAILURE`, **não escreve**, marcador
de sucesso intacto. `PARTIAL` e `STRATZ_BRACKET` continuam nos tipos só para **ler** snapshot e
histórico gravados por versões anteriores. Nenhum host novo, nenhuma mudança de CSP: reaproveita
`api:opendota-fetch`.

## Segredos

`.gitignore` cobre `.env*` inteiro (exceto `.env.example`), deliberadamente amplo para pegar
`.env.bak` e afins. **O app não usa mais segredo nenhum** — a OpenDota é pública. O que sobra é o
token pessoal da STRATZ que os scripts de medição de `scripts/` usam, e ele **não é revogável**:
se vazar, fica válido até expirar. Não colar em issue, log, teste, fixture ou captura de tela. Ele
vem de `STRATZ_API_KEY`, de `.gabarito/.stratz-token` (fora do git) ou da chave `stratzApiKey`
que uma versão anterior do app tenha deixado no `stratz_app_config.json` — o app não lê, não
grava e não apaga essa chave nem esse arquivo, de propósito, e a migração para
`glimpsegg_config.json` não a copia. Nenhum script imprime o token, e nada o embute no
bundle.
