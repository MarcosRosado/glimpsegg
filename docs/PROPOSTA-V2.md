# Proposta — GlimpseGG 2.0

Escrita em 2026-11-19 para a Fase 7 de [PLANO-OPENDOTA.md](PLANO-OPENDOTA.md). **Nada aqui foi
codado:** é a proposta que espera a aprovação do dono (item 6a do pedido), mais a decisão de
como publicar a 2.0.0 (6e). Renomes (6d), capturas e notas de versão (6f) só entram depois.

Toda rota e todo campo citado abaixo foi **conferido** — nas duas fixtures reais da OpenDota ou
com uma chamada real em 2026-11-19. O que não pôde ser conferido está marcado assim. Limiares das
métricas novas **não** estão aqui: saem por taxa de disparo medida na implementação (§4 do plano).

---

## 1. O que a doutrina exige do desenho (não negociável)

1. **Procedência e amostra a um hover de todo número.** Hoje três lugares falham nisso e a 2.0
   corrige: o MMR estimado da barra superior, o "benchmark alvo" do timer de itens
   (`ITEM_BENCHMARKS`, tabela fixa) e o radar de 5 eixos (constante `ROLE_BASELINES`) — os três
   precisam do chip de estimativa (`ROLE_BASELINE`).
2. **Seção sem dado some** — não vira card vazio decorado.
3. **"Replay não analisado" é estado de primeira classe** — é o caso comum. Medido hoje: das 13
   partidas da conta do dono abertas na conferência, **nenhuma** estava parseada.
4. **Glint sempre rotulado como experimental** (chip "beta" + tooltip com as métricas do teste).
5. **Nenhuma função atual se perde** — ver a tabela de-para no §5.

## 2. Inventário: o que cada tela mostra hoje

Resumo; o levantamento completo, componente a componente, ficou no histórico desta sessão.

| Tela | Conteúdo hoje | Problemas que o inventário achou |
| --- | --- | --- |
| **Barra superior** (`Navbar` + `StatRail`) | Marca, conta (avatar, medalha, MMR estimado), voltar à conta configurada, toggle do hero grid, busca `Ctrl+K`, atualizar, configurações. Faixa 2: patch + transição, forma V/D, Glint médio, KDA, GPM, % da carreira | MMR sem procedência |
| **Onboarding** | Idioma, privacidade, guia "como achar sua conta", campo de ID/link com confirmação da conta resolvida | — |
| **Dashboard** | `ProfileHeader` (KPIs de carreira, Glint médio, botão do espelho) · `MatchList` (40 recentes, filtros, até 4 tags, Glint, contexto, itens) · `RecentFormCard` · `StratzTrendsCard` (equalizer de Glint, KPIs de fila e ranque, distribuição de medalhas) · `MostPlayedHeroes` (filtra a lista) · `ActivityHeatmap` · `PerformanceTrendChart` · `StratzTeammatesCard` | Janelas 50/100 presas em 40 partidas; delta de winrate do trends **nunca aparece**; busca diz "herói ou ID" mas só filtra herói; linha de companheiro e ponto do gráfico parecem clicáveis e não fazem nada; sunburst de posição e histórico de rota escondidos deixam buracos no card |
| **Partida · cabeçalho** | Voltar, vencedor, id copiável, modo, duração, placar · `ParsePendingBanner` com "Pedir análise do replay" | O banner fica **por cima** do layout de partida parseada, que então mostra "sem dado" em série |
| **Partida · Visão geral** | Destaques (papéis no Glint, superlativos, melhor por posição) · comparativo de times · linha de vantagem · placar expansível com gaveta de itens | Ícones de prêmio da API no placar nunca aparecem |
| **Partida · Desempenho** | Seletor de jogador · cabeçalho (KDA, Glint, participação, fatias) · timer de itens · radar · **fase de rotas (veredito novo)** · combate · economia · habilidades · objetivos | Timer e radar sem procedência; "dano por tipo" e "ordem de skills" aparecem como **indisponível** em vez de sumir; textos fixos em pt-BR fora do `t()` |
| **Partida · Visão** | Minimapa com filtros, barra de tempo, KPIs de wards, linha do tempo clicável | Camada de mortes nunca aparece (a OpenDota não dá a posição) |
| **Partida · Coaching** | Forças e melhorias com chip de procedência e amostra | Recomendação de build e confrontos escondidos **sem aviso** |
| **Hero grid** (painel e réplica) | Ranking, frescor, bloqueios, histórico, réplica do layout com GlimpseScore | — (fica como está) |
| **Modais** | Busca (favoritos, recentes) · Configurações (conta, hero grid, app) | Busca não abre partida por id |

Órfãos: `MatchDynamicsOverview.tsx`, `TeammatesMatrix.tsx`. Nomes herdados: `StratzTrendsCard`,
`StratzTeammatesCard`, `stratz_app_config.json`, chaves `stratz_steam_id` e
`stratz_profile_history` do `localStorage`.

## 3. Navegação e hierarquia propostas

**A ideia:** a 1.0 foi desenhada em volta do que a STRATZ dava (IMP no centro, badge de rota em
toda linha). A 2.0 organiza em volta de **perguntas do jogador**: *como foi minha última
partida?*, *estou melhorando?*, *em que herói eu jogo bem?*, *o que mudar?*.

### 3.1 Moldura: barra lateral fixa

```
┌──────┬──────────────────────────────────────────────────────────────┐
│  G   │  Reider · Ancient 3        [ Buscar conta ou partida  Ctrl K ] ⟳ ⚙ │
│      ├──────────────────────────────────────────────────────────────┤
│ Início│                                                              │
│ Partidas                                                            │
│ Heróis│                    (conteúdo da seção)                       │
│ Conta │                                                              │
│ ───── │                                                              │
│ Grid  │                                                              │
└──────┴──────────────────────────────────────────────────────────────┘
```

- Seções fixas à esquerda: **Início · Partidas · Heróis · Conta**, e **Hero grid** separado (só
  com a feature ligada). Hoje tudo isso disputa uma página só.
- A busca `Ctrl+K` passa a aceitar **id de partida** (abre direto) além de conta — o que a
  dashboard já promete no placeholder e não cumpre.
- A `StatRail` sai da moldura e vira o topo do Início: menos ruído nas outras telas.

### 3.2 Início

```
┌─ Última partida ───────────────────────────┐ ┌─ Forma (últimas 20) ──────┐
│ Kez · Derrota · 35:58 · há 17 dias         │ │ V V D V D D V …  50%      │
│ ⚠ Replay não analisado  [Pedir análise]    │ │ Glint beta 41 (10 c/ nota)│
│ o que aparece depois: rota, visão, coaching│ │ KDA 2,57 · 605 GPM        │
└────────────────────────────────────────────┘ └───────────────────────────┘
┌─ Tendência (Glint · winrate · GPM) ─────────────────────────────────────┐
└──────────────────────────────────────────────────────────────────────────┘
┌─ Heróis mais jogados ─┐ ┌─ Atividade 30 dias ─┐ ┌─ Companheiros ─────────┐
```

Hierarquia: a **última partida** no topo, porque é o que se abre o app para ver — com o estado
do replay e a ação de pedir análise ali mesmo. Depois, tendência; depois, o resto.

### 3.3 Partidas

Lista completa, **paginada além das 40** (`/players/{id}/matches?offset=`, conferido), com
filtros de período, patch (`?patch=`, conferido: filtra no servidor), herói, modo, solo/grupo.
Linha mais limpa: herói, resultado, KDA, Glint beta, duração; tags e itens no hover/expansão.
Corrige as janelas 50/100 que hoje mentem.

### 3.4 Partida — o estado do replay decide o layout

Duas formas, não uma forma com aviso por cima:

- **Não analisada ("modo placar")**: cabeçalho, placar completo, destaques que só dependem do
  placar, Glint (vem dos percentis mesmo sem parse) e um cartão grande "Pedir análise do
  replay" que lista **o que vai aparecer** e acompanha a espera. As abas que precisam de parse
  não aparecem.
- **Analisada**: abas **Resumo · Meu jogo · Lutas · Visão · Coaching**, com o seletor de
  jogador fixo no cabeçalho (hoje cada aba tem o seu).
  - *Resumo*: destaques, comparativo, vantagem e **momento de virada**, placar.
  - *Meu jogo*: rota (veredito), farm por fonte, itens (com uso de item ativo), tempo morto,
    buyback, radar.
  - *Lutas* (nova): conversão de cada luta.
  - *Visão* e *Coaching*: como hoje, mais "visão que durou".

### 3.5 Heróis (nova seção)

Desempenho por herói com filtro de **período e patch**: partidas, winrate, KDA e Glint médio
das partidas com nota. Fonte: a lista completa que o app já baixa — hoje ela vem só com herói,
KDA, lado e resultado; precisa de `start_time` na projeção (barato) e do filtro `?patch=`. A
rota `/players/{id}/heroes` **continua quebrada** (conferido de novo: 127 linhas, todas com
`games: 0`) e não entra.

### 3.6 Conta (nova seção)

Totais e recordes da conta. Fontes conferidas: `/players/{id}/totals` (29 campos: abates,
mortes, GPM, `lane_efficiency_pct`, dano, cura, torres, stacks, compras de ward/gem/rapier,
`comeback`/`stomp`/`throw`/`loss`…), `/players/{id}/counts` (por modo, lobby, patch, lado,
`lane_role`) e recorde por campo via `/players/{id}/matches?sort=<campo>&limit=1`.

## 4. Funcionalidades novas (cardápio do §4 do plano)

Critério de entrada, igual para todas: janela e unidade declaradas, procedência na tela, taxa de
disparo medida antes de fixar limiar, teste na fixture real.

| Métrica | Fonte (conferida) | Janela · unidade | Situação |
| --- | --- | --- | --- |
| **Conversão de luta** | `teamfights[].players[]`: `gold_delta`, `xp_delta`, `damage`, `deaths`, `buybacks` (15 e 8 lutas nas fixtures) | por luta · ouro | Pronta para medir |
| **Farm por fonte** | `players[].gold_reasons` (12 e 10 códigos nas fixtures) | partida · % do ouro | **Falta a tabela de códigos**: `/constants/gold_reasons` não existe na OpenDota (404). Mapear pela fonte do parser, com teste |
| **Visão que durou** | `obs_log` × `obs_left_log` (37 colocadas, 33 com saída na fixture) | por ward · minutos vivos | O mapper já calcula vida útil; falta a métrica e a tela |
| **Tempo morto no pior momento** | `deaths_log[].time_dead` × `objectives` (33 e 22 eventos) | por morte · objetivo perdido | Pronta para medir |
| **Buyback** | `buyback_log` + luta seguinte em `teamfights` | por buyback | Rara (3 de 20 jogadores nas fixtures): pode não ter taxa que sustente afirmação — medir antes |
| **Uso de item ativo** | `item_uses` × `purchase_log` | por item · usos por minuto de posse | Pronta para medir |
| **Eficiência de rota** | `lane_efficiency`, `lane_efficiency_pct` | 10 min · % do ouro disponível | Pronta; complementa o veredito de rota |
| **Momento de virada** | `radiant_gold_adv` + `teamfights` (+ `comeback`/`stomp`/`throw`/`loss`) | partida · minuto | Pronta para medir |
| **Percentil no herói** | `players[].benchmarks` (o mesmo que alimenta o Glint) | partida inteira · percentil | Pronta; rotular "todos os ranques" |
| **Totais e recordes** | `/totals`, `/counts`, `matches?sort=` | carreira | Rotas conferidas |
| **Desempenho por herói** | lista completa + `?patch=` | período/patch | Precisa de `start_time` na projeção |
| **Confrontos herói × herói por faixa** | `/explorer` sobre `public_matches` (`radiant_team`, `dire_team`, `avg_rank_tier`, conferido) | — | **Não viável ao vivo:** uma consulta de um confronto, numa janela de **1 dia**, é cancelada por tempo (15 s). Só com coletor que agregue fora do app e publique o resultado (o mesmo problema de hospedagem da Fase 2 e da D6). Proposta: fica fora da 2.0 e vira item próprio |

**Recomendação de escopo da 2.0:** a moldura nova, as seções Partidas, Heróis e Conta, o "modo
placar" e as cinco primeiras métricas (conversão de luta, tempo morto, uso de item ativo,
eficiência de rota, momento de virada). Farm por fonte entra se a tabela de códigos fechar;
visão que durou e buyback, se a medição sustentar. Confrontos ficam para depois.

## 5. De-para: toda função da 1.0 tem destino

| Hoje | Na 2.0 |
| --- | --- |
| Barra: conta, medalha, voltar à conta configurada, hero grid, busca, atualizar, configurações | Topo da moldura (MMR estimado ganha chip de estimativa) |
| `StatRail` (patch, forma, Glint, KDA, GPM, carreira) | Início → cartão "Forma"; patch e transição no topo |
| Onboarding e guia da conta | Igual |
| `ProfileHeader` (KPIs de carreira, espelho) | Conta (KPIs) · Hero grid (espelho) |
| `MatchList` (filtros, tags, Glint, contexto, itens) | Partidas (paginada, com período e patch); a linha mais limpa, tags e itens na expansão |
| `RecentFormCard` | Início → "Forma" |
| `StratzTrendsCard`: equalizer de Glint, KPIs de fila/ranque, distribuição de medalhas | Início → "Tendência" (equalizer) · Conta (fila, ranque, medalhas) — renomeado |
| `MostPlayedHeroes` | Início (top 8) e Heróis (completo, com filtro) |
| `ActivityHeatmap` | Início |
| `PerformanceTrendChart` | Início → "Tendência" (janelas reais, sem o teto de 40) |
| `StratzTeammatesCard` | Início → "Companheiros" — renomeado; clique passa a abrir a conta do companheiro (hoje não faz nada) |
| Cabeçalho da partida e `ParsePendingBanner` | Cabeçalho + "modo placar" com o cartão de análise |
| Visão geral: destaques, comparativo, vantagem, placar e gaveta | Partida → Resumo |
| Desempenho: cabeçalho, timer de itens, radar, rota, combate, economia, habilidades, objetivos | Partida → Meu jogo (timer e radar com chip de estimativa; "dano por tipo" e "ordem de skills" **somem** em vez de dizer indisponível) |
| Visão (minimapa, filtros, KPIs, linha do tempo) | Partida → Visão |
| Coaching | Partida → Coaching (com nota de que build e confrontos estão fora, em vez de silêncio) |
| Hero grid (painel, réplica) | Seção Hero grid, sem mudança funcional |
| Busca e favoritos | Igual, aceitando id de partida |
| Configurações | Igual |

Ficam **escondidos** na 2.0, e as notas de versão dizem isso: recomendação de build (Fase 5),
coaching por minuto contra a média do herói (Fase 2), ameaça por tipo de dano e controle sofrido
(a OpenDota não mede), confrontos por faixa (sem pipeline). **Experimental:** Glint.

## 6. Renomes e migração (6d) — feito em 2026-11-19

Tudo abaixo entrou como descrito: `electron/configMigration.cjs` (arquivo de config) e
`src/utils/legacyStorage.ts` (`localStorage`), cada um com teste; os dois órfãos saíram com as
dez chaves de tradução que só eles usavam.

- `StratzTrendsCard` → `TrendsCard`; `StratzTeammatesCard` → `TeammatesCard`.
- `stratz_app_config.json` → `glimpsegg_config.json`. Migração no primeiro início: se o novo não
  existe e o antigo existe, **copia** todas as chaves menos `stratzApiKey` e deixa o antigo
  intocado. Motivo: o app não lê, não grava e não apaga essa chave (doutrina), e os scripts de
  medição ainda a procuram no arquivo antigo como último recurso. Teste sobre a migração pura.
- `localStorage`: `stratz_steam_id` → `glimpsegg_steam_id`, `stratz_profile_history` →
  `glimpsegg_profile_history`, migrados uma vez no caminho browser.
- Os dois órfãos são apagados.

## 7. Como publicar a 2.0.0 (6e) — decisão sua

O passo de versão do `release.yml` faz sempre **última tag + 1 no patch**, e só roda em push na
`main` ou disparo manual. Isso descarta a tag à mão: criar `v2.0.0` manualmente **não gera
artefato** (nenhum gatilho roda sobre tag), e o push seguinte na `main` viraria `v2.0.1`.

**Recomendação — ensinar o passo de versão a respeitar o `package.json`:**

1. No passo "Compute, commit and tag next version": se `major.minor` do `package.json` for
   **maior** que o da última tag, a próxima versão é a do `package.json` (`2.0.0`); senão,
   segue somando 1 ao patch, como hoje. Uma comparação de dois números, testável.
2. No commit da 2.0, editar `version` para `2.0.0` **uma vez** — a única exceção à regra "não
   editar à mão", documentada no `CLAUDE.md`.
3. As notas de versão: hoje a release nasce com `--notes ""`. Proposta: se existir
   `docs/release-notes/v<versão>.md`, usar `--notes-file`; senão, vazio como hoje. É o caminho
   para as notas da 2.0 (o que saiu, o que entrou, o que é experimental) chegarem à página da
   release e ao auto-updater.

Alternativa sem mexer no workflow: disparo manual (`workflow_dispatch`) depois de criar a tag e
o commit à mão — funciona, mas depende de uma sequência manual exata e não deixa rastro de
regra. Não recomendo.

## 8. O que preciso que você decida

1. **Moldura**: barra lateral (proposta) ou manter abas no topo?
2. **"Modo placar"**: partida não analisada sem as abas que dependem de parse (proposta) ou com
   as abas visíveis e desabilitadas, com o motivo?
3. **Escopo da 2.0**: o recorte do §4 (cinco métricas + seções novas) ou outro?
4. **Confrontos por faixa**: aceitar que ficam fora da 2.0 (precisam de coletor + hospedagem, a
   mesma decisão da D6)?
5. **Publicação**: a recomendação do §7 (workflow respeita o `package.json` + notas por arquivo)?
6. **Veredito de rota com xp** (D1, pendente desde o item 3): a regra hoje usa só patrimônio.

### Decidido pelo dono em 2026-11-19

| Ponto | Decisão |
| --- | --- |
| 1. Moldura | **Decidido (sobre os wireframes): combinação de A e C.** Barra lateral com Início, Partidas, Heróis, Conta e Hero grid, **recolhível num trilho de ícones e aberta por padrão**. O estado aberta/recolhida é lembrado por usuário (conveniência local, com try/catch) |
| 2. Partida não analisada | **Decidido: recorte menor.** A tela diz claramente que o replay não foi analisado e mostra só o que já está disponível, **sem** as seções que dependem de análise — a linha do "modo placar" do §3.4. Saem também dessa tela, confirmado pelo dono: o comparativo de times, a lista completa de "quem liderou" e o "melhor de cada posição" |
| 3. Escopo | **Decidido: o recorte do §4.** Entram as seções novas (Partidas, Heróis e Conta) e as cinco métricas (conversão de luta, tempo morto no pior momento, uso de item ativo, eficiência de rota, momento de virada). Outras métricas do §4 entram se se mostrarem pertinentes durante o desenvolvimento, cada uma pelo critério de lá: janela e unidade declaradas, procedência na tela, taxa de disparo medida e teste na fixture real |
| 4. Confrontos por faixa | **Fora da 2.0**, como recomendado — não foram citados no escopo |
| 5. Publicação | **Decidido: a recomendação do §7 (opção a).** A versão vira 2.0.0 e chega ao usuário pelo auto-update normal: o passo de versão passa a respeitar um `major.minor` maior no `package.json`, e as notas saem de `docs/release-notes/v<versão>.md` quando o arquivo existe. O `version` só vai para `2.0.0` no commit final da 2.0, junto com as notas |
| Início | **Decidido: opção A.** Última partida no topo (com o estado do replay e o botão de pedir análise ali mesmo), depois forma e tendência, depois heróis, atividade e companheiros |
| Partida analisada | **Decidido: opção A.** Abas Resumo · Meu jogo · Lutas · Visão · Coaching, com o seletor de jogador fixo no cabeçalho. Abre em **Meu jogo** quando a partida é da conta configurada, e em **Resumo** nos outros casos |
| Seções novas | **Aprovadas:** Partidas, Heróis e Conta |
| Heróis: amostra pequena | **Decidido pela recomendação (sessão de interface):** herói com menos de 5 partidas no recorte sai marcado como "amostra pequena", como no wireframe |
| Conta: contagem por modo | **Decidido pela recomendação:** ficou fora da primeira versão da Conta, porque `formatGameMode` sem a fila chamava o modo 1 de "All Pick Casual". Com `matchModeKey` (modo sem fila sai "All Pick", sem afirmar casual) ela pode voltar |
| 6. Veredito de rota com xp | **Decidido: o xp entra, com o mesmo peso do patrimônio** ("o XP é tão importante quanto o patrimônio"). Remedido no mesmo dia, aceite mantido: 99,1% em 7.42 e 98,7% em 7.41 (ver a Fase 3 do plano) |

O redesenho da interface corre numa sessão própria; esta trilha segue com o que não é tela.
**O que andou antes do layout**, cada parte testada e commitada: as funções
puras das métricas novas em `src/utils/` (teste nas fixtures reais, taxa de disparo medida nos
pares), a paginação da lista de partidas (`offset`), `start_time` na projeção da lista completa
com o filtro `?patch=`, e os renomes com migração do config (§6).
