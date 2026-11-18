# Patch 7.42 — plano de atualização

Patch publicado em 2026-11-18 às 08:00 UTC. Notas lidas, cerca de 13 horas depois, do datafeed da Valve
(`https://www.dota2.com/datafeed/patchnotes?version=7.42&language=english`).
Roteiro genérico: [PATCH-CHECKLIST.md](PATCH-CHECKLIST.md). Este arquivo é a aplicação dele ao
7.42: o que já foi feito, o que espera dado e o que espera decisão.

Estado das fontes no dia do patch:

| Fonte | Já conhece o 7.42? |
| --- | --- |
| Datafeed da Valve (`itemlist`, `itemdata`, `patchnotes`) | Sim |
| Steam News (primeira fonte do `gameVersionService`) | Sim — "7.42 Gameplay Update" casa com o regex, o app já resolve `7.42` sozinho |
| OpenDota `constants/patch` | Não — para em 7.41 |
| OpenDota `constants/item_ids` / `items` | Não — 596 ids, nenhum dos 23 novos |
| STRATZ (`gameVersions`, `itemFullPurchase`, `winWeek`, `heroAverage`) | Não verificado (exige token) |

---

## 1. Feito na working tree (sem commit)

| O quê | Onde |
| --- | --- |
| Sync de itens passa a ler o datafeed da Valve como fonte primária, com OpenDota e o catálogo atual por baixo | `scripts/sync-items-full.cjs` |
| Catálogo regenerado: 23 ids novos, 62 custos, 28 tiers neutros (596 → 619 itens, nenhum removido). Nem todo custo é do 7.42: Dagon, Necronomicon, Heart, Daedalus, Octarine, Hurricane Pike e Dragon Lance não têm mudança de custo nas notas — o catálogo já estava defasado | `src/constants/items.ts` |
| `CURRENT_GAME_PATCH` → `7.42` | `src/constants/gameVersion.ts` |
| Horn of Battle e Greater Horn of Battle entram em `GENERIC_CONSUMABLES` | `src/components/match/ScoreboardTable.tsx` |
| Seis ids errados de `ITEM_BENCHMARKS` corrigidos (ver §2) | `src/utils/performanceEnricher.ts` |
| §2 do checklist e os `CLAUDE.md` de `scripts/` e `constants/` descrevem o sync novo | `docs/`, `scripts/`, `src/constants/` |
| Aviso de transição de patch (chip no topbar, banner no coaching e no layout espelho), ligado por `PATCH_TRANSITION` até 2026-12-02 | `src/constants/gameVersion.ts`, `src/utils/patchTransition.ts`, `src/components/ui/PatchTransitionNotice.tsx` |
| Skypiercer (1948) entra em `PHYSICAL_RIGHT_CLICK`; Heaven's Halberd fica, com a justificativa anotada | `src/constants/counterItems.ts` |
| Badge `NEW` passa a ler `NEW_HERO_IDS` (hoje só Largo, 155); Kez e Ringmaster perdem o selo | `src/constants/heroes.ts`, `MostPlayedHeroes.tsx` |
| Script que confere os gatilhos do §3.1 sem exibir o token | `scripts/check-patch-readiness.cjs` |

Itens novos compráveis: Bloodslinger (1942, 925g), Ristul's Devotion (1944, 3800g), Caduceus
(1955, 5400g), Sabatons of Mordiggian (1953, 5950g), Skypiercer (1948, 6000g), Starforge (1946,
6000g). Drop do Tormentor: Greater Horn of Battle (1951). Neutros novos: Red Ledger (T1), Brick
(T2), Balmhook e Vile Phial (T3), Helm of the Hivemind (T4).

Removidos do jogo, **mantidos no catálogo** para partida antiga continuar legível: Javelin (7),
Helm of the Overlord (635), Khanda (1808). Quarterstaff (10) voltou, a 900g.

Não há herói novo: os 127 ids da `herolist` da Valve foram comparados com as chaves do
`HEROES_MAP` e todos existem (o `1961` das notas é o Spirit Bear).

## 2. Bug antigo encontrado no caminho

`ITEM_BENCHMARKS` tinha seis ids que não correspondiam ao comentário — nada a ver com o 7.42:

| Id antigo | Comentário | O que o id era de fato | Id correto |
| --- | --- | --- | --- |
| 218 | Glimmer Cape | Observer and Sentry Wards | 254 |
| 121 | Orchid | Bloodstone | 98 |
| 686 | Bloodthorn | Quicksilver Amulet | 250 |
| 640 | Kaya and Sange | receita da Orb of Corrosion | 273 |
| 158 | Sange and Yasha | Mjollnir | 154 |
| 247 | Mjollnir | Moon Shard | 158 |

Efeito: esses seis itens caíam no degrau por custo, e Bloodstone, Mjollnir e Moon Shard eram
comparados com o timing de outro item. Os **valores** em segundos não foram tocados.

## 3. Pendências que esperam dado

Nenhum limiar calibrado foi alterado: o §6 do checklist proíbe ajuste no olho, e ainda não existe
amostra de 7.42. Cada linha tem o gatilho que a destrava.

### 3.1 Esperam as APIs

`node scripts/check-patch-readiness.cjs` confere os gatilhos de Valve, OpenDota,
`gameVersions`, `itemFullPurchase` e `winWeek` de uma vez, e imprime `[ok]` ou `[pendente]` por
linha. Ele usa o token do app sem exibi-lo.

| Pendência | Gatilho verificável | Ação |
| --- | --- | --- |
| Agregados de meta ainda misturam 7.41 | `itemFullPurchase` de um herói qualquer devolve algum id novo (1942, 1944, 1946, 1948, 1953, 1955) | Até lá, o `buildAdvisor` não recomenda item novo e ainda pode recomendar Khanda ou Helm of the Overlord. O cache já virou (a chave leva o patch), então o app **rotula como 7.42 um agregado que é quase todo 7.41** — ver decisão D1 |
| `winWeek` (STRATZ) e `/heroStats` (OpenDota) do layout espelho | Sete dias de patch: a partir de 2026-11-25 a janela semanal é só 7.42 | Nada a editar; só não confiar na ordem do espelho antes disso |
| `heroAverage` da STRATZ (benchmark `HERO_AVERAGE`) | Curva de um herói mudar em relação à capturada em `match-parsed.json` | Se não mudar em ~2 semanas, o benchmark é de 7.41 e precisa de rótulo — ver D1 |
| OpenDota publicar o catálogo | `constants/patch` lista 7.42 e `constants/item_ids` contém `1942` | Rodar `node scripts/sync-items-full.cjs` de novo; diff esperado: vazio |
| Datafeed da Valve lido no dia do patch | Alguns dias de patch, ou sair um 7.42a | Rodar o sync de novo mesmo sem a OpenDota: hotfix de custo no primeiro dia é comum. Reexecutado no mesmo dia, o sync deu arquivo idêntico |
| Itens sem ícone no CDN (404): Stone of Recall (1949), Berserker's Hood (1881), Nothl Sigil (1883), Claszian Timepiece (1884) | `HEAD` no PNG devolve 200 | São itens que as notas não citam (provavelmente não lançados). Nada a fazer se nunca aparecerem em partida |
| Enums novos de modo/lobby | Partida 7.42 com `gameMode`/`lobbyType` formatado cru | `formatGameMode`/`formatLobbyType` em `src/utils/dotaFormatters.ts` |
| Schema de `playbackData`/`stats` da STRATZ | `npm test` vermelho em `tests/services/stratzGql.test.ts` contra uma resposta 7.42 real, ou campo novo de Tormentor/pip | Recapturar fixture (manual, anonimizada) |

### 3.2 Esperam amostra de partidas 7.42

Remedir com o mesmo procedimento e tamanho da calibração original (100 partidas para
`MatchList`, 60 para `awardEngine`), anotando data e taxa de disparo. Esperar ao menos uma semana
de patch para o meta assentar.

| Mecânica do 7.42 | O que ela desloca | Símbolos a remedir |
| --- | --- | --- |
| Ouro passivo fixo em 90/min (subia até 111), bounty de kill `100 + 10×nível` (era `125 + 8×nível`), torres, barracas e Roshan pagando menos | GPM e patrimônio caem, mais em partida longa | `FARM_GPM`, `UNSPENT_GOLD` (`MatchList.tsx`); `ROLE_BASELINES.gpm`; `goldPerMinute >= 750` de `classifyMatchDynamic` (`stratzGql.ts`); baselines do `calculateCustomImp` (`performance.ts`) |
| +50 XP/min passivo para todos, tabela de XP mais cara do nível 5 ao 18 (total 64.400 → 66.600) | XPM sobe para suporte; nível 30 chega em outro minuto | `MAX_LEVEL` (taxa de disparo de 13%), `ROLE_BASELINES.xpm` |
| "Spell Power Reduction": menos dano mágico/puro, menos amp, cast range e AoE de item; HP base 120 → 200, 20 HP por força (era 22) | Dano de herói por minuto cai, fatia física sobe | `ROLE_BASELINES.heroDamagePerMin`, `DAMAGE_SHARE_PCT`, `HERO_HEALING`, `SUPERLATIVES` de dano e cura (`awardEngine.ts`), `BASELINE_SHARE = 0.54` em `insights/rules/deaths.ts`, limiares de `threatProfile` (arquétipo `MAGIC_BURST`) |
| Tormentor aos 15:00 (era 20:00) dropando Shard a partir da 2ª morte; Roshan com respawn decrescente; Glyph com 2 cargas | Jogo acelera, torre cai em outro ritmo | `TOWER_DAMAGE`, `MARATHON_MIN`, `durMin <= 32` / `>= 45` de `classifyMatchDynamic` |
| Creep puxado anda até 25% mais lento; menos melee creep depois dos 30 min; siege a cada 2,5 min | CS e denies por minuto | `CS_PER_MIN`, `DENIES`, `ROLE_BASELINES.cs10Min`/`denies10Min` |
| Receitas e custos (Butterfly 5000, Halberd 2400, MoM 1800, Bloodthorn sem Javelin, Abyssal e Harpoon com Dragon Lance) | Timing de item | Valores de `ITEM_BENCHMARKS` (Butterfly 30:00, Abyssal 35:00, Bloodthorn 26:00, Maelstrom 13:00), `firstCoreTimingMin`, `deltaSec <= -45` / `>= 60` (`PlayerPerformanceTab.tsx`) |
| IMP da STRATZ recalibrado para o patch (se for) | Distribuição do IMP | `IMP_EXTREME` (400 jogadores), `ROUGH_GAME_MAX_IMP` |

Limiares relativos (`KILL_PARTICIPATION_PCT`, margens de superlativo) tendem a sobreviver, mas
entram na mesma medição para confirmar a taxa.

### 3.3 Mapa

O terreno mudou: Twin Gates foram para as bordas, T1 e T2 do mid andaram 260–350 unidades,
acampamentos e a fonte Dire mudaram de lugar. Alcance e duração de ward **não** mudaram, então
`OBSERVER_VISION_UNITS`, `SENTRY_TRUE_SIGHT_UNITS` e as durações ficam como estão.

| Pendência | Gatilho | Ação |
| --- | --- | --- |
| `public/minimap.png` é do 7.41 | Imagem oficial do minimapa 7.42 disponível | Trocar a imagem **e** recalibrar `MAP_IMAGE_INSET` contra ela (procedimento no topo de `mapGeometry.ts`, conferido por `tests/utils/minimapCoords.test.ts`). Atualizar "patch 7.41" nos dois README |
| Âncoras de calibração (runas, 544 wards) | Junto com a troca da imagem | Conferir se as âncoras de runa continuam no mesmo ponto; as wards de 7.41 não servem para validar terreno novo |

Até a troca, ward de partida 7.42 é plotada sobre terreno de 7.41: a posição em coordenada está
certa, o desenho embaixo é que está velho no mid e nas bordas.

## 4. Remover a transição quando estabilizar

**Pendência com dono: não esquecer.** O aviso de transição é temporário por desenho.

| Gatilho | Ação |
| --- | --- |
| `node scripts/check-patch-readiness.cjs` mostra `[ok]` em "algum item novo do patch aparece no agregado" **e** em `winWeek` | Voltar `PATCH_TRANSITION` para `null` em `src/constants/gameVersion.ts` e commitar. O componente, a função e as chaves de i18n **ficam** — são reutilizados no próximo patch |
| Chegou 2026-12-02 e ninguém mexeu | O aviso some sozinho (prazo de 14 dias). Ainda assim zerar a constante, e conferir no script se os agregados de fato viraram — se não viraram, o prazo estava curto e vale estender em vez de zerar |

"Nenhum item removido aparece mais" pode demorar mais que os outros dois gatilhos, se a janela do
`itemFullPurchase` for longa; não segurar a remoção por ele sozinho.

## 4b. Decisões

- **D1 — Rotular agregado em transição: decidido e aplicado.** O aviso está ligado por
  `PATCH_TRANSITION`. Falta só o fechamento, que é a pendência abaixo.
- **D2 — `counterItems.ts`: decidido e aplicado.** Skypiercer entrou; Halberd ficou pelo disarm.
  Ristul's Devotion não entrou (aura ofensiva, não é resposta a um arquétipo de ameaça).
- **D3 — Badge `NEW`: decidido e aplicado.** Lê `NEW_HERO_IDS`. Largo é de 2025; se o selo nele
  não fizer sentido, esvaziar o conjunto.
- **D4 — Texto de coaching.** Varredura feita em `i18n/translations.ts`: nenhuma chave cita
  Tormentor, Glyph, Twin Gates, tier de neutro ou item removido. Nada a mudar; fica registrado
  para não refazer a busca. A regra "patrimônio aos 20 minutos" compara com `heroAverage`, então
  depende do gatilho do §3.1, não de texto.
- **D5 — `abilities.ts`: conferido, nada a mudar.** Dos 13 heróis mapeados (ids 1, 2, 5, 8, 11,
  14, 17, 26, 35, 44, 74, 131, 145), as notas só trocam talentos; nenhuma habilidade básica ou
  ultimate foi substituída ou renomeada, e o arquivo não mapeia talentos.

## 5. Ordem de execução sugerida

1. Agora: revisar o diff, rodar o app contra uma partida 7.42 e uma 7.41, commitar.
2. Em alguns dias, e de novo quando a OpenDota publicar o 7.42: rodar o sync.
3. A partir de 2026-11-25: rodar o script de prontidão; se der `[ok]`, remover a transição (§4).
4. Uma a duas semanas de patch: coletar as amostras e remedir o §3.2.
5. Quando houver minimapa oficial: §3.3.
