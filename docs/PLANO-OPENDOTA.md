# Plano — sair da STRATZ e rodar só com OpenDota e Valve

Escrito em 2026-11-19, um dia depois do 7.42. Formato igual ao de
[PATCH-7.42.md](PATCH-7.42.md): o que já foi medido, o que espera dado e o que espera decisão,
cada pendência com gatilho verificável.

**A ideia central.** As duas APIs leem o mesmo replay. Enquanto a STRATZ ainda responde, ela
serve de **gabarito**: para cada coisa que só ela calcula (IMP, veredito de rota, média do herói),
ajustamos uma versão própria sobre os campos crus da OpenDota e medimos o erro contra o valor da
STRATZ **na mesma partida**. Depois que a versão própria passa no critério de aceite, a STRATZ sai
daquele ponto. Onde não houver como aproximar, a seção some ou ganha métrica própria com outro
nome — nunca número antigo com rótulo novo.

**Por que agora.** Sinais medidos de que a STRATZ está sem manutenção:

- `gameVersions` ainda para em 7.41f (id 190), e a STRATZ marca com 190 **tanto** partida de
  7.41f quanto de 7.42 — ela não conhece o patch novo. Consequência prática, medida em
  2026-11-19: `gameVersionId` **não separa patch**. Quem separa é a OpenDota (`patch` 60 = 7.41,
  61 = 7.42; virada em 2026-11-18T21:28:07Z, de `/constants/patch`).
- IMP ausente em 4 das 16 partidas ranqueadas parseadas **de 7.41** da amostra (dias 15 a 17 de novembro).
  Não é efeito do patch: o gabarito já está falhando, e cada semana tira amostra.
- `itemFullPurchase` sem nenhum item novo e `winWeek` uma semana atrás.

> **Mudança de rumo em 2026-11-19 (mesmo dia).** O dono decidiu não esperar as fases para
> soltar o app: **a STRATZ saiu do tempo de execução hoje**, antes dos aceites. O app abre só
> com o Steam ID, tudo vem da OpenDota, e o que não tem substituto aceito fica **escondido**
> (veredito de rota, coaching por minuto contra a média do herói, recomendação de build) —
> com uma exceção assumida: a nota de impacto entra já como **Glint experimental**, rotulada
> como tal. As fases abaixo continuam valendo, mas mudam de papel: deixam de ser pré-requisito
> para remover a STRATZ e passam a ser o caminho para **devolver** cada seção escondida e
> tirar o "experimental" do Glint. A STRATZ continua sendo consultada só pelos scripts de
> `scripts/`, como gabarito, enquanto responder. Detalhe no §7.

---

## 1. O que já foi medido

Amostra: 17 partidas parseadas nas duas APIs (170 jogadores). **Pequena e enviesada** — três
contas de pro, todas Immortal, todas com mais de 20 minutos, 16 de 7.41 e 1 de 7.42. Serve para
dizer o que é viável, não para fixar limiar.

| O que a STRATZ entrega | Equivalente na OpenDota | Medido |
| --- | --- | --- |
| `position` 1 a 5 | `position_est` | Igual em 165/170 (97%); core × suporte 99% |
| Wards com posição, tempo e quem destruiu | `obs_log`, `sen_log`, `obs_left_log` | Mesma contagem em 170/170. **Mesmo espaço de células** (64–192): a OpenDota dá decimal (`118.2, 175.3`), a STRATZ dá o par truncado (`118, 174`) |
| `deathEvents` | `deaths_log` (tempo, ouro perdido, tempo morto) | Mesma contagem em 169/170 |
| Séries por minuto | `gold_t`, `networth_t`, `xp_t`, `lh_t`, `dn_t`, `hero_damage_t`, `tower_damage_t`, `hero_healing_t`, `camps_stacked_t` | Presentes; valor a valor **não comparado** |
| Compras, habilidades, itens | `purchase_log`, `ability_upgrades_arr`, `item_*`, `neutral_item_history` | Presentes |
| Dano recebido por herói e por fonte | `damage_taken`, `damage_inflictor_received` | Presentes |
| Divisão físico/mágico/puro | não existe; só o inflictor | Ataque básico como "físico": erro médio de 7,2 pp, r = 0,77 |
| `top/mid/bottomLaneOutcome` | não existe; `lane`, `lane_role`, `networth_t[10]`, `lane_efficiency` | Patrimônio da rota aos 10 min acerta a direção em 82% (51 rotas). A STRATZ chama de `TIE` rota com até 35% de diferença: usa mais que ouro |
| `imp` | não existe; `benchmarks` (percentis por jogador) | `calculateCustomImp` atual: r = 0,68, erro médio 16, mesmo sinal 76%, mesmo melhor da partida 5/13, mediana −15 contra −4. Média dos percentis da OpenDota: r = 0,63 |
| `heroAverage` por minuto, posição e ranque | `/benchmarks?hero_id&bracket&role` — percentis da **partida inteira**, `role` só `core`/`support` | Não há curva por minuto |
| `itemFullPurchase`, `heroVsHeroMatchup` | `itemPopularity`, `scenarios/itemTimings`, `heroes/{id}/matchups` | Amostras de dezenas a centenas (Anti-Mage: 76 jogos no maior confronto, 9 por linha de timing) contra 330 mil. Abaixo do `MATCHUP_MIN_SAMPLE` (150) do próprio app |

Fatos de infraestrutura, lidos das próprias APIs:

- **OpenDota sem chave: 3.000 chamadas por dia, 60 por minuto** (`/metadata`: `freeCallLimit`,
  `freeRateLimit`; confirmado pelos cabeçalhos `x-rate-limit-remaining-*`).
- `/parsedMatches` lista ids já parseados (100 por página, paginável por `less_than_match_id`).
  `POST /request/{match_id}` pede o parse de uma partida.
- `/explorer` aceita SQL, mas `player_matches` só tem partida profissional (3.170 linhas em 12
  dias). `public_matches` tem 847 mil linhas em 26 horas, porém só id, ranque médio e os dez
  heróis — sem estatística de jogador.
- **A STRATZ devolve a média do herói sem precisar de partida:**
  `heroStats.stats(heroIds, positionIds, bracketBasicIds, groupByTime, minTime, maxTime)` retorna
  o mesmo tipo de `heroAverage`, com 70 campos. Anti-Mage pos 1 Divine/Immortal aos 10 min:
  45.277 partidas. Dá para tirar uma fotografia da tabela inteira com um script.
- **O IMP expõe seus insumos.** `imp.matchGenerator(matchId)` devolve, por minuto: abates,
  mortes, assistências, cs, denies, nível, dano físico/mágico/puro, dano recebido, cura em
  aliados, runas e neutros, mais `winChance` e `impValues`. Ou seja, o IMP é um modelo de chance
  de vitória sobre essas séries contra a média do herói. Só `runePower` não tem par direto na
  OpenDota. A consulta foi acertada em 2026-11-19: o caminho é
  `stratz.page.imp.matchGenerator(matchId)` (não `imp` na raiz) e a resposta traz `winChance`
  (uma série da partida), `winRateByPlayerMinuteValues`, `impValues` e `events` (dez jogadores ×
  minuto; `events` com `time, kills, deaths, assists, cs, dn, level, physicalDamage,
  magicalDamage, pureDamage, damageReceived, healingAllies, runePower, neutrals`, cumulativos).
  A série do IMP por minuto também existe na consulta de partida: `players.stats.impPerMinute`.

Os scripts que produziram estes números foram promovidos para `scripts/` em 2026-11-19, e os 17
pares e a amostra de controle estão guardados em `.gabarito/` (`pairs-2026-11-19.json` e
`control-sample-2026-11-19.json`, fora do git). Rodar
`node scripts/compare-sources.cjs .gabarito/pairs-2026-11-19.json` da raiz reproduz esta tabela
offline.

---

## 2. O que se perde, sem volta

Nenhum destes tem campo na OpenDota. A saída é esconder a seção ou trocar a afirmação.

| Some | Consequência no app |
| --- | --- |
| Controle e slow **sofridos** (`stunCount`, `slowDuration` recebidos) | Arquétipos `HARD_LOCKDOWN` e `SLOW_KITE` e a regra `matchupThreatLockdown`, corrigida nesta semana. A OpenDota só tem `stuns` causados |
| `isBurst`, `isDieBack`, `isAttemptTpOut`, posição da morte | `deathsBurst` e a manchete `compositeBurstNoDispel`. Posição só existe para morte dentro de `teamfights[].players[].deaths_pos` |
| Tipo de dano medido | `MAGIC_BURST`/`PHYSICAL_RIGHT_CLICK` passam a depender de uma tabela de tipo por habilidade (constantes), com erro de ~7 pp |
| `invisibleSeconds` | Arquétipo `INVISIBILITY` |
| Cobertura de parse automática | A STRATZ parseia sozinha; na OpenDota a maioria das partidas públicas exige pedido e espera. Precisa de estado "parse pendente" — flag nova em `MatchDataAvailability` |
| IMP e veredito de rota **na lista de partidas** | A lista vem de `/players/{id}/matches`, que não traz série por minuto. Sem parse por partida, não há badge de rota nem de impacto na dashboard |

---

## 3. Fases

Ordem por dependência: o substituto do IMP precisa dos benchmarks, que precisam do mapper.

### Fase 0 — Guardar o gabarito e decidir se vale seguir (urgente)

A única fase com prazo: o gabarito está se degradando.

| Tarefa | Entregável | Gatilho de conclusão |
| --- | --- | --- |
| Promover os scripts de medição | `scripts/compare-sources.cjs` e `scripts/sample-control.cjs`, lendo o token como o `check-patch-readiness.cjs` (nunca impresso) | Rodar da raiz reproduz a tabela do §1 |
| Fotografar `heroStats.stats` | JSON com herói × posição × faixa × minuto, datado e com `matchCount` | Todas as 127 × 5 × faixas presentes ou marcadas vazias |
| Colher pares rotulados | 1.000+ partidas parseadas nas duas APIs, **estratificadas**: 5 faixas de ranque × 3 de duração (< 25, 25–40, > 40 min), com `imp`, `position`, outcomes de rota e `impValues` | Nenhuma célula do estrato com menos de 50 partidas |
| Acertar a consulta `imp.matchGenerator` | Série por minuto dos insumos e do IMP de uma partida | Resposta 200 guardada como fixture anonimizada |

**A fotografia e os pares nunca entram no repositório nem no app (D5, decidido).** São régua
interna: servem para validar as curvas próprias (aceite da Fase 2) e os modelos das Fases 3 e 4.
Ficam em diretório local ignorado pelo git. Colher agora mesmo assim — custa um script e alguns
minutos, e não colher é irreversível se a STRATZ sair do ar.

**Ponte até os benchmarks próprios encherem:** percentis da OpenDota (`/benchmarks`, por herói,
faixa e core/suporte), rotulados como "partida inteira". O coaching por minuto fica **desligado**
nesse intervalo, em vez de rodar sobre dado emprestado.

**Conta de viabilidade dos benchmarks próprios.** 3.000 chamadas por dia ≈ 2.900 partidas
parseadas ≈ 29 mil linhas de jogador por dia.

| Granularidade | Células | Linhas para 200 por célula (uniforme) | Dias, no melhor caso |
| --- | --- | --- | --- |
| herói × posição × 4 faixas | 2.540 | 508 mil | 18 |
| herói × posição | 635 | 127 mil | 5 |
| herói × core/suporte | 254 | 51 mil | 2 |

A distribuição real é muito desigual, então o prazo verdadeiro para as células comuns é algumas
vezes maior e as raras nunca enchem. Por isso o desenho é **hierárquico**, e cada nível é uma
`BenchmarkSource` própria, rotulada na UI:

1. herói × posição (curva própria por minuto) — alvo principal;
2. herói × core/suporte, quando a célula de posição tem menos de 200;
3. percentil da OpenDota (`/benchmarks`, partida inteira) — só para métrica sem janela;
4. `ROLE_BASELINE`, como hoje.

Recorte por faixa de ranque entra como **ajuste escalar** sobre a curva, não como célula.

**Critério de corte — contínuo (decidido em 2026-11-19).** A medida continua a mesma: a fatia
das linhas de jogador que cai em célula de nível 1 ou 2 com amostra suficiente (200 linhas),
com 60% como referência. O que mudou é que **não há mais prova em data marcada** ("em 14 dias"):
`scripts/benchmark-coverage.cjs` mede isso sobre o que estiver em disco, quando for rodado, e
grava uma linha em `.gabarito/coverage-log.jsonl`. Lê-se a **tendência** — se a série achatar
bem abaixo de 60% no ritmo de coleta que dá para manter, o benchmark próprio não se sustenta sem
chave paga (D6) e o plano para na Fase 1 (modo sem token, sem coaching por benchmark). A rotina
de coleta e de leitura está em [COLETA-GABARITO.md](COLETA-GABARITO.md).

### Fase 1 — Mapper `mapOpenDotaMatch` → `MatchDetails`

Não depende de nenhuma decisão e já entrega valor: abrir partida sem token.

- Função pura em `src/services/`, irmã de `mapStratzMatch`, com fixture **real e anonimizada**
  (`match-parsed-opendota.json`) e teste de ponta a ponta. Idealmente a mesma partida da fixture
  atual, para comparar os dois `MatchDetails` campo a campo.
- `computeAvailability` desliga o que falta: `damageReport` parcial, `heroAverage`,
  `laneOutcomes`. Flag nova `parsePending`.
- Wards: reaproveitar `minimapCoords` declarando o espaço — é o mesmo espaço de células, com
  decimal. Verificar em teste contra os pares do §1 antes de plotar.
- Pedido de parse (`POST /request`) e a espera, nos dois caminhos de rede. Nenhum host novo.

**Aceite:** nas partidas da Fase 0, KDA, itens, patrimônio final, contagem de wards e de mortes
idênticos aos da STRATZ; posição igual em pelo menos 95%.

### Fase 2 — Benchmarks próprios

- **A base já está sendo colhida** (desde 2026-11-19): `collect-pairs.cjs` grava em
  `.gabarito/matches/` a metade OpenDota de toda partida que passa na triagem e cai em célula de
  par cheia. Falta o agregador que publica as curvas; `benchmark-coverage.cjs` já lê essa base
  para a cobertura e para a prévia do aceite.
- Coletor em `scripts/` que lê `/parsedMatches`, baixa as partidas e agrega por célula:
  cumulativos por minuto de patrimônio, xp, cs, denies, dano em herói, dano em torre, cura, stacks
  e abates/mortes/assistências.
- Guardar **quantis** (p25, p50, p75), não só a média: é o que a OpenDota não tem por minuto e a
  STRATZ nunca teve, e permite dizer "abaixo de 75% dos carregadores" em vez de "abaixo da média".
- Onde mora, sem backend: workflow agendado que publica o JSON num **branch de dados** ou em
  asset de release. Nunca na `main` (todo push ali gera release) e sem token da STRATZ no CI.
  Host novo ⇒ CSP, `EXTERNAL_HOST_ALLOWLIST` e handler IPC.
- Chave de cache inclui o patch; o dataset carrega patch, data e `sampleSize` por célula.

**Aceite:** nas células em que a fotografia da STRATZ tem mais de 5.000 partidas, a curva própria
de patrimônio e cs fica a menos de 5% dela nos minutos 10, 20 e 30 (comparando 7.41 com 7.41).
Dois cuidados que a primeira leitura da fotografia mostrou: (1) o índice `time` da STRATZ pode
não ser o mesmo minuto do índice dos arrays `*_t` da OpenDota — na fotografia o patrimônio em
`time: 1` é o ouro inicial — então a comparação sai nos dois alinhamentos e vale o de menor
erro, medido; (2) a fotografia é de **uma semana** (`week` 2967) e a nossa amostra é
estratificada por ranque, então a fotografia é reponderada pela mistura de faixas da nossa
amostra antes de comparar.

### Fase 3 — Veredito de rota próprio

**Decidido em 2026-11-19 (D1): regra própria e transparente, sem imitar as classes da STRATZ.**
O critério dela é opaco (chama de empate rota com até 35% de diferença de patrimônio), e
perseguir concordância total com uma caixa-preta que vai ser desligada é mirar no alvo errado.

- **A regra:** diferença de patrimônio e de xp aos 10 minutos entre quem estava na rota (`lane`).
  Empate é a faixa do meio; "atropelo" exige margem grande. Limiares calibrados por taxa de
  disparo medida, não ajustados para reproduzir a STRATZ.
- **O número aparece ao lado do badge:** "Rota vencida · +1,2k aos 10 min". O veredito mostra a
  própria base.
- **A doutrina muda de redação, não de espírito:** de "só de `top/mid/bottomLaneOutcome`" para
  "só de dado dos 10 primeiros minutos de quem estava na rota". Continua proibido usar vitória,
  mortes, Glint ou qualquer sinal da partida inteira. `resolvePlayerLaneResult` continua recebendo
  só o que é da rota. Atualizar o `CLAUDE.md` raiz e o de `utils/` junto com o código.
- Sinais secundários da mesma janela (cs e denies, abates e mortes da rota, torre caída) entram
  só se melhorarem a validação abaixo; começar pelo mais simples.
- **Custo assumido:** o veredito de algumas partidas antigas muda em relação ao que o app mostra
  hoje.

**Aceite:** direção igual à da STRATZ em pelo menos 90% das rotas em que **as duas** dizem que
alguém venceu, nos pares de 7.41 e de 7.42. Discordância em empate não conta como erro. A linha de
base é 82% de direção com a versão só-ouro e limiar de 10%. **Abaixo disso:** sai com nome próprio
("Vantagem aos 10 min", com o número ao lado) e nunca como "Rota Vencida".

**Remedido em 2026-11-19 com xp — aceite mantido.** O dono decidiu a D1: o xp entra com o
mesmo peso do patrimônio ("o XP é tão importante quanto o patrimônio"). As variantes só de
patrimônio saíram do script — escolha do dono, não do dado —, e entre as com xp a escolha
continuou só em 7.41: **`nwxp-head-rel`**, média por herói de cada lado, diferença relativa de
patrimônio e de xp, score = média das duas. Retrato congelado de 1.092 partidas (treino com
2.635 rotas de 7.41, teste com 639 de 7.42). Empate abaixo de 6,65% (25% das rotas), atropelo
a partir de 37,45% (10%). Direção igual à da STRATZ onde as duas dizem que alguém venceu:
**99,1% em 7.42** (431/435, IC95 97,7–99,6%, cobertura 92,2%) e **98,7% em 7.41** (1.775/1.799,
IC95 98,0–99,1%, cobertura 92,4%) — passou pelo limite inferior nos dois. Nas pareadas: 99,8%
(7.41) e 100% (7.42, 413/413). **Rota desigual:** 74,4% no treino (n=82, IC95 64–83%), segue
fora do veredito (`evenLaneOnly`). Linha de base só-patrimônio no mesmo retrato: 98,5% e 98,8%,
com cobertura de 86,8% e 86,4%. O badge passou a mostrar as duas diferenças da rota ("+1,2k de
patrimônio · +800 de xp"); na fixture de referência o top 2v2 virou de empate para "Rota
vencida" pelo xp (patrimônio +5,2%, xp +12,0%). O script confere a função do app contra a regra
em toda rota: 3.274/3.274.

**Medido em 2026-11-19, antes do xp (histórico) — aceite atingido.** `scripts/fit-lane-verdict.cjs` (taxas, escolha de
variante e régua escritas no cabeçalho antes de calcular qualquer concordância). Regra escolhida
só em 7.41: patrimônio aos 10 min, **média por herói** de cada lado, diferença relativa; empate
abaixo de 7,51% (25% das rotas), atropelo a partir de 43,32% (10%). Direção igual à da STRATZ
onde as duas dizem que alguém venceu: **98,8% em 7.42** (423/428, IC95 97,3–99,5%, cobertura
90,7%) e **99,2% em 7.41** (1.174/1.183, IC95 98,6–99,6%). Passou pelo limite inferior do IC95,
não só pelo ponto. Linha de base recalculada na mesma estatística (só patrimônio, soma, empate
< 10%): 98,8% e 98,7% — o 82% do §1 era outra estatística (três classes, empate contra empate
contando como acerto, 51 rotas). Classe exata igual à da STRATZ: ~74%, fora do critério e sem
problema. **Rota desigual** (2v1, 1v2, 3v2; ~5% das rotas) concorda só 84,5% no treino (n=58,
IC95 73–92%): decidido pelo número do treino que ela **nunca** vira "Rota vencida" — sai como
"Vantagem aos 10 min" com a diferença por herói. Nas pareadas: 100% (7.41) e 99,8% (7.42). O
campo `lane` foi conferido trocando top e bot na STRATZ: as laterais caem para 54%. Ligado ao
detalhe da partida (`utils/laneVerdict.ts` → `mapOpenDotaMatch` → `PlayerPerformanceTab`, com a
diferença da rota ao lado e a régua no tooltip); as regras de coaching `laningLaneStomped` e
`laningLaneLost` voltaram a disparar, com o texto sem citar a STRATZ. O script termina
conferindo que a função do app reproduz a regra em toda rota (2.429/2.429).

### Fase 4 — Glint, a nota de impacto própria

**Nome e escala decididos em 2026-11-19 (D2).** A nota se chama **Glint** e vai de **0 a 100**,
com **50 = o esperado para o herói naquela posição**. A escala muda de propósito: com −50 a +50
todo mundo compararia com o IMP, e os números não vão bater. O tooltip mostra a **composição** —
os dois componentes que mais puxaram a nota (luta, farm, sobrevivência, objetivo) — que é o que a
separa de um número opaco.

O nome só entra junto com o modelo. Enquanto o valor exibido for o IMP real, o rótulo continua
IMP: chamar de Glint um número que não é nosso seria procedência errada.

- Reconstruir a partir dos insumos que o IMP declara (lista do §1), contra o benchmark da Fase 2,
  por minuto e por posição. Modelo linear por posição ajustado nos pares de 7.41; `winChance` da
  STRATZ como alvo auxiliar.
- Corrigir de saída o viés medido: a fórmula atual tem mediana −15 e satura em ±50.

**Aceite**, contra as linhas de base medidas (r 0,68 · erro 16 · sinal 76% · melhor da partida
5/13): r ≥ 0,85, erro médio ≤ 9 pontos (Glint contra IMP + 50, as duas escalas têm amplitude 100),
mesmo lado do 50 em ≥ 88%, mesmo melhor da partida ≥ 60%, em partidas de 7.42 que não entraram
no ajuste. **Abaixo disso:** o Glint não é lançado como nota única; os componentes
saem separados e `TOP_CORE`/`TOP_SUPPORT` passam a sair de superlativos como o MVP.

### Fase 5 — Recomendação de build

A parte mais fraca. A OpenDota não tem volume: nem `itemPopularity`, nem `itemTimings`, nem
`matchups` chegam ao piso de amostra do app.

- Caminho próprio: o coletor da Fase 2 já vê `purchase_log` e resultado. Agregar item × herói ×
  posição com vitória e minuto mediano de compra. Mesma conta de viabilidade: só sustenta itens
  comuns em heróis comuns; o resto cai em "sem amostra" e a UI esconde.
- Confrontos: `public_matches` do `/explorer` tem os dez heróis e o vencedor em volume alto
  (847 mil em 26 horas). **Dá para calcular herói contra herói por faixa de ranque com amostra
  real** — é a única métrica de meta em que a OpenDota supera o que a STRATZ entrega hoje.

**Aceite:** concordância com `itemFullPurchase` da fotografia de 7.41 nos 10 itens mais comprados
de 30 heróis comuns. Sem isso, a aba mostra só confrontos.

### Fase 6 — Dashboard e remoção

Perfil, histórico e companheiros por `/players/{id}`, `/matches`, `/peers`, `/wl`. Badges de rota
e impacto na lista só para partida já aberta (resultado em cache); as outras ficam sem badge.
Depois disso, a STRATZ sai por completo (D4, decidido): código, token, CSP, fixtures e textos. Fica um crédito de inspiração no README.

### Fase 7 — Versão 2.0

**Pedida em 2026-11-19.** Sair da STRATZ, a nota própria e as métricas novas mudam o que o app
é; isso merece virar a 2.0 em vez de mais um patch da 1.0. Entra **depois** das etapas acima que
devolvem o que ficou escondido — uma 2.0 com seções faltando seria anunciar a perda.

- **Rework da interface, mais moderna e intuitiva, sem perder função.** A interface atual foi
  desenhada em volta do que a STRATZ entregava (IMP no centro, veredito de rota como badge).
  Antes de codar: inventário do que cada tela mostra hoje, proposta de navegação e de hierarquia
  visual, e **aprovação do dono sobre a proposta** — rework é gosto, não se decide sozinho.
  Fica de fora mexer em `build/icon.svg` e na marca, salvo pedido.
- **O que a doutrina exige do desenho novo:** procedência e `sampleSize` continuam a um hover de
  todo número; seção sem dado some em vez de mostrar vazio decorado; o estado "replay não
  analisado" é cidadão de primeira classe (é o caso comum), não um aviso por cima da tela
  antiga; e o Glint aparece como experimental enquanto for.
- **Funcionalidades novas que a OpenDota permite** — a lista do §4 é o cardápio; cada uma entra
  pelo critério de lá (janela e unidade declaradas, procedência na tela, taxa de disparo medida,
  teste na fixture real). Candidatas mais fortes, por já terem o dado na resposta da partida:
  conversão de luta (`teamfights`), farm por fonte (`gold_reasons`), visão que durou
  (`obs_log` × `obs_left_log`), tempo morto no pior momento (`deaths_log` × `objectives`),
  buyback e uso de item ativo. Fora da partida: totais e recordes da conta
  (`/players/{id}/totals`, `/records`), desempenho por herói com filtro de período e de patch
  (a lista completa de partidas já é baixada) e confrontos herói contra herói por faixa de
  ranque (`/explorer` sobre `public_matches`, a única métrica de meta em que a OpenDota supera
  o que a STRATZ entregava).
- **Renomear o que ainda leva o nome antigo:** `StratzTrendsCard`, `StratzTeammatesCard`,
  `stratz_app_config.json`, as chaves `stratz_*` do `localStorage` — as duas últimas com
  migração, porque há config de usuário em disco.
- **Como a versão vira 2.0.0.** O workflow de release só incrementa o **patch** da última tag
  (`.github/workflows/release.yml`), então nenhum push produz uma 2.0 sozinho. Precisa de uma
  mudança deliberada: ensinar o passo de versão a respeitar um `package.json` com major ou minor
  **maior** que o da última tag (e só então editar a versão à mão, uma vez), ou criar a tag
  `v2.0.0` manualmente. Decidir qual antes do primeiro push da 2.0.
- **Na mesma leva:** capturas de tela novas nos dois READMEs (as atuais são da 1.0), notas de
  versão dizendo o que saiu, o que entrou e o que é experimental, e o crédito à STRATZ.

**Aceite:** toda função da 1.0 que tem dado na OpenDota continua alcançável; nenhuma seção
escondida "por enquanto" continua escondida sem estar listada nas notas de versão; `npm test`,
`npm run build` e `icons:check` verdes; e o dono aprovou a interface rodando o app, não por
captura.

---

## 4. Métricas próprias

Critério para entrar: janela e unidade declaradas, procedência e `sampleSize` na tela, taxa de
disparo medida antes de fixar limiar (alvo de 5% a 15%), e teste na fixture real.

| Métrica | De onde sai | O que afirma |
| --- | --- | --- |
| **Eficiência de rota** | `lane_efficiency` (ouro obtido ÷ ouro disponível na rota aos 10 min) | Unidade absoluta, comparável entre heróis; hoje o app só tem cs@10 |
| **Conversão de luta** | `teamfights[].players[]`: `gold_delta`, `xp_delta`, dano, mortes | Saldo de ouro por luta; quem ganha ouro lutando e quem só aparece |
| **Farm por fonte** | `gold_reasons` (creep, herói, estrutura, neutro, passivo) | "62% do seu ouro veio de neutros" — diagnóstico que IMP nenhum dá |
| **Tempo morto no pior momento** | `deaths_log.time_dead` × `objectives` (Roshan, torres, barracas) | Estava morto quando o objetivo caiu |
| **Visão que durou** | `obs_log` × `obs_left_log.attackername` | Vida real de cada ward e quem dewardou; base do "ward em ponto manjado" |
| **Momento de virada** | `radiant_gold_adv` + `teamfights` + flags `comeback`/`stomp` | A luta em que a vantagem trocou de lado, e quem participou |
| **Uso de item ativo** | `item_uses` × tempo de posse (`purchase_log`) | BKB comprado aos 18 min e usado 2 vezes em 22 minutos |
| **Percentil no herói** | `benchmarks[].pct` (já vem por jogador) | Sem amostra própria nenhuma; rotulado como partida inteira, todos os ranques |
| **Buyback** | `buyback_log` × resultado da luta seguinte | Buyback que virou luta contra buyback que morreu de novo |
| **APM e ações por tipo** | `actions`, `actions_per_min` | Curiosidade; só entra se correlacionar com alguma coisa |

Substitutos de arquétipo perdidos: lockdown por **composição** (quantos inimigos têm stun, por
constantes de habilidade, cruzado com `ability_uses` reais) em vez de controle sofrido medido —
afirmação mais fraca, rotulada como tal.

---

## 5. Protocolo de validação

Fixado antes de ajustar qualquer modelo, para não escolher a régua depois do resultado.

- Divisão **por partida**, nunca por jogador (dez linhas da mesma partida não são independentes).
- Ajuste em 7.41, teste em 7.42. Se a STRATZ parar de rotular 7.42, o teste é a parte de 7.41 que
  ficou de fora, e isso fica escrito ao lado do número.
- Estratos de ranque e duração reportados em separado: média geral esconde erro em partida curta.
- Todo limiar leva ao lado amostra, data e taxa de disparo, como em `threatProfile.ts`.
- Métrica que não passa no aceite não é ajustada até passar: muda de nome ou some.

---

## 6. Decisões que são suas

| # | Decisão | Por que não é técnica |
| --- | --- | --- |
| D1 | ~~O veredito de rota pode vir de modelo próprio?~~ — **decidido em 2026-11-19: sim, regra própria e transparente, com patrimônio e xp de mesmo peso** | Patrimônio e xp aos 10 min de quem estava na rota, as duas diferenças ao lado do badge, STRATZ só para conferir direção. Detalhe na Fase 3. A primeira implementação usava só patrimônio (a escolha automática do script, 99,2% contra 99,1% com xp no treino); o dono decidiu no mesmo dia que **o xp entra** ("o XP é tão importante quanto o patrimônio"). Remedido com xp (`nwxp-head-rel`): 99,1% em 7.42 e 98,7% em 7.41, cobertura de ~92%, aceite mantido |
| D2 | ~~A nota própria pode se chamar IMP?~~ — **decidido em 2026-11-19: chama-se Glint, escala 0 a 100.** **Revisto no mesmo dia: o nome entra já, como "Glint (experimental)"**, antes do modelo do plano | O plano dizia "o nome só entra junto com o modelo". O dono preferiu soltar uma versão experimental a ficar sem nota: regressão sobre oito percentis da OpenDota por herói (`src/utils/glint.ts`), ajustada ao IMP em 7.41 e testada em 7.42 — r 0,82, erro 10,2, mesmo lado 82%, mesmo melhor da partida 49% (reajuste do mesmo dia, com 566 partidas de treino; o primeiro deu 51%), **abaixo** do aceite da Fase 4. Consequências que valem enquanto for experimental: o rótulo e o tooltip com as métricas vão junto de todo número; não se diz "50 = esperado para herói e posição" (o centro medido é ~45 e o percentil é por herói); não há composição no tooltip |
| D3 | ~~`TOP_CORE`/`TOP_SUPPORT` continuam saindo de nota de impacto?~~ — **decidido em 2026-11-19: saem do Glint experimental**, e o card mostra a nota ao lado | Herdam o erro da nota (mesmo melhor da partida em 49% contra o IMP). Sem nota na partida, os dois prêmios e o "dia difícil" são omitidos; o MVP continua saindo de superlativos |
| D4 | ~~STRATZ removida ou opcional?~~ — **decidido em 2026-11-19: removida por completo, e antecipada para o mesmo dia** | **Etapa 1, feita:** nenhuma tela, hook ou serviço em uso fala com a STRATZ; saíram o token do onboarding e das configurações, o handler `api:stratz-graphql`, `api.stratz.com` da CSP, a fonte STRATZ do hero grid e do resolvedor de patch, e a recomendação de build (escondida). **Etapa 2, feita em 2026-11-19:** `services/stratzGql.ts`, a fixture `match-parsed.json`, os testes do mapper da STRATZ, a escala `IMP` do `awardEngine`, `calculateCustomImp`, os formatadores de IMP e o `stratzQuery?` do `electron.d.ts` saíram. Os testes de coaching e destaques rodam sobre duas fixtures reais da OpenDota (a de referência e `match-uneven-lane-opendota.json`, escolhida pelo que dispara) via `tests/support/fixtureMatches.ts`; o que só a STRATZ tinha entra por sobreposição **sintética e rotulada**. **Sobra, feita em 2026-11-19:** `buildVisionData` (o parser do formato da STRATZ) e `STRATZ_WARD_TYPE_INT` saíram; os testes dos helpers de visão rodam sobre a visão que o `mapOpenDotaMatch` monta das duas fixtures reais, com o uptime conferido segundo a segundo contra os `obs_log` crus. Ficam: o valor `PLAYER_STATS` de `VisionSource` (sem produtor; o `WardMinimapTab` ainda rotula esse caso, e a remoção mexe em UI e dicionário), `MatchPlayer.imp`/`availability.imp` (marcador) e a fixture `match-imp-generator.json` (régua da Fase 4) |
| D5 | ~~A fotografia de `heroStats.stats` pode ser embarcada?~~ — **decidido em 2026-11-19: não embarcar; colher e usar só como régua interna.** | Embarcar contradiz D4 e o dado já nasce velho no 7.42. Fora do repositório e do app. Ponte: percentis da OpenDota, com coaching por minuto desligado até a Fase 2 fechar |
| D6 | Chave paga da OpenDota no coletor? | Tira o teto de 3.000 chamadas por dia; é custo recorrente e segredo no CI |
| D7 | ~~O que fazer com a recomendação de build se a Fase 5 não passar?~~ — **decidido na prática em 2026-11-19: escondida** até a Fase 5 | A seção não renderiza e o hook não chama a rede; `utils/buildAdvisor.ts` fica, puro e testado, para a volta |

---

## 7. Estado (2026-11-19)

| Item | Estado |
| --- | --- |
| Fase 0 · promover os scripts de medição | **Feito.** `compare-sources.cjs` e `sample-control.cjs` reproduzem o §1 offline |
| Fase 0 · fotografia de `heroStats.stats` | **Feito em 2026-11-19.** `.gabarito/hero-stats/2026-11-19/` (210 MB, fora do git): 127 heróis × 5 posições × 4 faixas = **2.540 células, todas com dado**, minutos 0 a 60, 74 campos por linha. Conferência do §1: Anti-Mage pos 1 Divine/Immortal aos 10 min = 45.278 partidas (medido antes: 45.277). **Resposta vazia da STRATZ não é prova de célula vazia:** na primeira passada um herói comum veio sem linha nenhuma em duas faixas e outra requisição omitiu uma posição; as 11 células voltaram completas ao repetir (`--retry-empty`). 32 células têm menos de 61 minutos (33 a 60 linhas) e **não foram reconferidas** — pode ser célula rara sem minuto tardio ou a mesma omissão |
| Fase 0 · pares estratificados | **Em coleta diária** — rotina em [COLETA-GABARITO.md](COLETA-GABARITO.md). `collect-pairs.cjs` tem uma trilha por patch (teto de 90 por célula **por patch**) e grava também o volume só-OpenDota. Estado em 2026-11-19 às 11h40: 213 pares de 7.42 e 208 de 7.41, com a coleta de 7.41 ainda rodando; a maior célula tem 33 pares e partida com menos de 25 min soma 4 em 7.41. Números atuais em `node scripts/collect-pairs.cjs --status`. Cada par guarda a resposta da OpenDota, a partida da STRATZ (com itens, wards e `impPerMinute`) e os insumos do `matchGenerator`. Dos 213 de 7.42: IMP nos dez jogadores em 197, gerador em 200, três rotas rotuladas em 213. **Lições da primeira execução:** (1) o patch vem da OpenDota, não do `gameVersionId` da STRATZ, que é 190 nos dois; (2) a raiz `matches(ids)` da STRATZ responde "User is not an admin." — a triagem em lote usa cem `match(id)` com alias na mesma requisição; antes disso o coletor rodou sem triagem, e 317 de 544 candidatas (58%) gastaram a chamada para cair em `modo`; (3) partida curta e Herald/Guardian são raras em `/parsedMatches` e podem não chegar a 50. Gatilho (nenhuma célula abaixo de 50, nos dois patches) **não atingido**. **Às 12h15 de 2026-11-19:** 801 pares (588 de 7.41, 213 de 7.42); 7.41 com 7/15 células abaixo de 50 (as três de partida curta, com 1 a 5 pares, e Herald/Guardian 25–40 com 31), 7.42 com 15/15. Um coletor manual da trilha 7.41, aberto fora da rotina, colheu até as 12h50 e parou num **429 por minuto da OpenDota** (coincidiu com a conferência do app, que abriu 13 partidas e as tabelas de percentil no mesmo IP): 1.092 pares, **879 de 7.41 com 5/15 células abaixo de 50** (as três de partida curta, com 2 a 12, Herald/Guardian 25–40 com 65 já acima; faltam LT25 e Immortal LT25), 213 de 7.42 com 15/15. Sobraram 1.197 chamadas no dia: como o saldo já está abaixo de 1.500, a rotina das 15h pula a trilha 7.41 e vai direto para a 7.42, que é o conjunto de teste e não andou hoje. IMP nos dez jogadores segue em ~93% dos pares |
| Fase 0 · consulta `imp.matchGenerator` | **Feito em 2026-11-19.** O caminho real é `stratz.page.imp.matchGenerator(matchId)`. Resposta 200 guardada como fixture: `src/services/__fixtures__/match-imp-generator.json`, a **mesma partida** de `match-parsed-opendota.json` (cs e denies batem minuto a minuto). A resposta não traz dado identificável; o id real não está no repositório |
| Fase 1 · `mapOpenDotaMatch` | **Feito e testado** na fixture real `match-parsed-opendota.json` (outra partida, não a de `match-parsed.json`: os ids da fixture antiga foram anonimizados e não dá para buscar a mesma) |
| Fase 1 · `parsePending`, pedido de parse | **Feito** nos dois caminhos de rede (`requestOpenDotaParse`, handler `api:opendota-request-parse`). Formato de `POST /request/{match_id}` **verificado com chamada real em 2026-11-19**: 200 com `{"job":{"jobId":<número>}}`; a especificação diz que cada pedido conta como 10 chamadas. `GET /request/{jobId}` devolveu `null` para partida já parseada, então a espera deve olhar a partida, não o job. A espera e a tela ainda não existem |
| Fase 1 · aceite | **Aberto — medido, parcial e com duas pendências.** `scripts/accept-phase1.cjs` roda o `mapOpenDotaMatch` real sobre os pares e compara a **saída do mapper** com a STRATZ. Em 130 pares (1.300 jogadores, todos 7.42), 2026-11-19 às 11h09: KDA 1.300/1.300, itens 1.300/1.300, patrimônio final 1.300/1.300, wards 1.300/1.300, **mortes 1.299/1.300**, **posição 1.270/1.300 (97,7%)**. Posição por estrato, todos acima do piso de 95%: 95,6% a 99,3% por ranque; 95,5% (< 25 min, só 11 partidas), 98,0% (25–40) e 97,7% (> 40). Com 100 pares o estrato de partida curta estava em 94,4% — a amostra ali ainda é pequena demais para o número valer. **Bug achado e corrigido:** um Meepo (herói 82) com 4 mortes nas duas APIs saía com 5 eventos. Ele pegou a Aegis aos 1.743 s (`objectives`, `CHAT_MESSAGE_AEGIS`) e o `deaths_log` tem um grupo de linhas aos 1.818 s com `time_dead` de 5 s: a morte com Aegis, que o placar não conta. Único caso em 104 pegadas de Aegis de 130 partidas. `mapDeaths` agora tira o grupo com o tempo exato da Aegis **só** quando há mais grupos que mortes no placar, com teste sobre o log real. Depois da correção, em 213 pares: mortes 2.130/2.130. **Pendências:** (1) cobertura — nenhuma célula chegou a 50, e nenhum par de 7.41 tinha sido medido; (2) posição em Herald/Guardian estava em 94% com 20 partidas (188/200), abaixo do piso de 95% — é `position_est` da OpenDota, não há o que corrigir no mapper; se o número se mantiver com a célula cheia, o aceite de posição não fecha nesse estrato e isso fica escrito, sem baixar a régua. Fecha quando a coleta completar: `node scripts/accept-phase1.cjs`. **Medido de novo às 12h15, com 804 pares (591 de 7.41):** KDA, itens e patrimônio 100%; mortes 8.038/8.040 (as duas divergências em 7.41); posição 97,1% no total e **91,5% em Herald/Guardian** (105 pares), abaixo do piso, como previsto; **wards 8.014/8.040, todas as 26 divergências em 7.41** (7.42 segue 100%). Conferido num par (9095917110): é **atribuição**, não contagem — uma sentinela aos ~1.700 s está no `sen_log` do slot 2 na OpenDota e no slot 3 na STRATZ, total do time igual, e a própria OpenDota se contradiz ali (`sen_placed` 4 contra 6 linhas no `sen_log`). Dado da fonte; o mapper não foi mexido |
| Fase 2 · benchmarks próprios | **Iniciada em 2026-11-19; aceite longe.** Feito: a base (volume só-OpenDota em `.gabarito/matches/`, pela rotina diária agendada), o agregador `scripts/build-benchmarks.cjs` (curvas cumulativas por minuto com n, média, p25, p50, p75, em herói × posição e herói × core/suporte, em `.gabarito/benchmarks/<patch>.json`) e a medição `scripts/benchmark-coverage.cjs` (critério de corte contínuo + curva contra a fotografia; série em `--history`). **Medido em 2026-11-19, com 326 partidas:** nenhuma célula com 200+ linhas (maior: 45), então critério de corte 0% e **aceite não medido**. O que existe é exploração com piso de 20 linhas em 4 células de 7.41: erro mediano de 4,2% em patrimônio e cs com o minuto da STRATZ deslocado em um (`time` t = índice t−1 da OpenDota) contra 11% e 16% sem deslocar — indício de que o deslocamento é real, não prova. **Falta:** volume (a rotina diária), o ajuste escalar por faixa de ranque, e — só depois do aceite — publicar para o app (workflow agendado, branch de dados, `BenchmarkSource` nova) e ligar. Abates, mortes e assistências por minuto ficam fora: a OpenDota não tem a série. D6 segue aberta |
| Fase 3 · veredito de rota próprio | **Aceite atingido e ligado em 2026-11-19; xp incluído no mesmo dia (D1, decisão do dono).** Patrimônio e xp com o mesmo peso: 99,1% de direção igual à da STRATZ em 7.42 (IC95 97,7–99,6%, n=435) e 98,7% em 7.41; rota desigual sai como "Vantagem aos 10 min"; o badge mostra as duas diferenças. Detalhe na Fase 3. **Pendente:** os badges da lista de partidas (Fase 6, só para partida já aberta) |
| D4 · etapa 2 | **Feita em 2026-11-19.** Ver a linha D4 do §6. 848 testes verdes; `placeholders.test.ts` passou a falhar se uma regra deixar de disparar em todas as fontes (exceções listadas à mão: `visionUptimeLow`, `visionWardsLostEarly`, que nenhuma das duas fixtures reais dispara). Regras que disparavam com dado **real** na fixture da STRATZ e hoje só têm sobreposição sintética: `farmingCurveBehind`, `farmingNetworthHigh`/`Low` (curva `heroAverage`) e `matchupThreatMagical`/`Physical` (divisão de dano) — todas dormentes no app até a Fase 2. `farmingStacksHigh`, `fightKpHigh` e `visionCoverageLow` voltaram a ter dado real pela segunda fixture. `fightDamageLow`, `matchupThreatLockdown`, `compositeBurstNoDispel` e as forenses de morte **nunca** disparavam com dado real (o composto já vinha de mortes sintéticas no teste antigo) |
| Fase 1 · ligar à tela | **Feito em 2026-11-19**, junto com a saída da STRATZ. Detalhe da partida por `fetchOpenDotaMatchDetails`; partida não parseada abre com o placar e um aviso com o botão "Pedir análise do replay" (`POST /request`, só no clique, e a espera consulta a partida com recuo e teto de ~5 min) |
| Fase 6 antecipada · dashboard sem STRATZ | **Feito em 2026-11-19.** `services/openDotaProfile.ts`: perfil, vitórias, 40 partidas recentes, companheiros e heróis mais jogados (contados na lista completa de partidas — `/players/{id}/heroes` devolvia `games: 0` para os 127 heróis de uma conta com 2.870 partidas). **O que a lista perdeu:** veredito de rota, posição, prêmio, participação em abates, fatia de dano, torres do time e patrimônio final. Onboarding e configurações pedem só a conta Steam |
| Glint experimental | **No ar desde 2026-11-19, abaixo do aceite da Fase 4.** `src/utils/glint.ts` + `scripts/fit-glint-experimental.cjs`. Regressão linear sobre oito percentis da OpenDota (por herói, partida inteira, todos os ranques). **Reajustado no mesmo dia** com os pares novos, sobre um retrato congelado (o coletor gravava durante o ajuste): treino em 566 partidas de 7.41 (eram 326), teste nas mesmas 197 de 7.42 — por papel r 0,82, erro 10,2, mesmo lado 82%, mesmo melhor da partida **49%** (era 51%); sem papel r 0,79, erro 10,7, 81%, 49%. Limiares por quantil: `extremeLow` 8→7, `impact` 52→53, `strong` 69→68, os outros iguais. Mais treino não moveu o teste: o gargalo é o modelo (só K/D/A já dá r 0,79 a 0,81), não a amostra. Na lista de partidas a nota sai dos totais crus + tabela pública `/benchmarks` (diferença mediana de 0,002 a 0,003 para o percentil que vem na partida). A escolha das oito métricas olhou o conjunto de teste: os números são um pouco otimistas. **Sai do "experimental"** quando a Fase 4 passar no aceite; o teste de 7.42 só cresce quando a trilha 7.42 do coletor andar |

**Fora do mapper, por falta de dado na OpenDota** (além do §2): ordem de skills
(`ability_upgrades_arr` não traz o tempo e a tela mostra o tempo), dano recebido por habilidade
(o inflictor vem por nome e o app não tem tabela nome → `abilityId`) e posição da morte.

## 8. Ordem sugerida

0. **Feito em 2026-11-19:** a STRATZ saiu do app (etapa 1 de D4), com o Glint experimental.
   O que segue é para devolver o que ficou escondido e para a etapa 2.
1. **Esta semana:** Fase 0 inteira. É a única coisa que não pode esperar.
2. ~~Etapa 2 de D4~~ — **feita em 2026-11-19** (fixtures da OpenDota + sobreposição sintética
   rotulada; `stratzGql.ts` e `match-parsed.json` apagados).
3. Coleta diária pela rotina de [COLETA-GABARITO.md](COLETA-GABARITO.md). O critério de corte é
   contínuo: ler a série de `benchmark-coverage.cjs --history` e responder D6 quando a tendência
   estiver clara.
4. Fases 2 → 3 → 4; cada uma só fecha com o aceite medido. **A Fase 3 fechou antes da 2**
   (2026-11-19): o veredito de rota não precisa de benchmark, só dos 10 primeiros minutos da
   própria partida.
5. Fase 5 (volta da recomendação de build) e os badges de rota e impacto na lista para partida já aberta.
6. **Fase 7 — versão 2.0:** rework da interface e funcionalidades novas da OpenDota, com
   proposta aprovada antes de codar.
