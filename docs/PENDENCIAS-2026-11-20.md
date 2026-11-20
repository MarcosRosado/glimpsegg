# Pendências de 2026-11-20

O que a reescrita de texto ([`VOZ.md`](VOZ.md)), o rebalanceamento de layout e a medição de
desempenho encontraram e **não** corrigiram. Cada item diz onde está e por que ficou. O que foi
corrigido está no histórico do git do mesmo dia.

## Desempenho (a decidir com o dono)

Medido com o app de dev e um log temporário por chamada: com a OpenDota lenta, toda rota por
jogador levava de 38 a 106 s, inclusive `/wl`, e para qualquer conta (uma conta pública de
profissional deu 34 s e 500 na `/wl`). A abertura levou ~60 s, Heróis e Conta ~90 s, e a partida
e as abas ~1 s. Três propostas, nenhuma feita:

1. **Abrir com o último perfil salvo e atualizar em segundo plano.** É o que mais muda a
   experiência com a OpenDota lenta.
2. **Tirar da abertura a chamada que baixa o histórico inteiro** (`heroMatches` em
   `fetchPlayerProfile`). O resultado, `mostPlayedHeroes`, não é usado por nenhuma tela.
3. **Limite de ~2 min por chamada** em `api:opendota-fetch` e no ramo browser de `openDotaGet`,
   para uma chamada que nunca responde virar erro com "tentar de novo". Abaixo disso quebra hoje:
   houve resposta legítima de 106 s. O POST de parse fica de fora (timeout ali vira nova tentativa
   e mais 10 chamadas).

## Código que dá número errado

- **`threatPct` em `matchupCounterItem` e no composite** (`utils/insights/build.ts:87`, `:139`):
  para ameaça de stun e outros arquétipos o valor cai no % de dano físico. O número saiu do texto
  das duas regras; corrigir o cálculo permite devolvê-lo.
- **Rank escolhido à mão sai como "no seu rank"** (`utils/heroGrid/sourcePrecedence.ts:177-180`):
  `resolveMetaBracket` marca `isPlayerSpecific: true` para qualquer rank manual. Quem escolhe
  Divino sem ser Divino lê "no seu rank".
- **Configurações salvam a conta sem confirmar nome e foto**, ao contrário do onboarding. Busca
  por link `/id/` ou por nome pega o primeiro resultado da OpenDota (`steamResolver.ts:46-64`) e
  pode salvar a conta errada sem aviso.
- **"Ranking do layout de origem: nenhum ranking ainda"** com a última sincronização em sucesso
  (visto na tela do hero grid). Não investigado.

## Ramos mortos (texto que nunca aparece)

- `vision.source === 'PLAYER_STATS'` não tem mais produtor: `visionSourceEstimated` e o ramo de
  estimativa do `WardMinimapTab` só servem a ele.
- `buildVision` devolve `deaths: []` e `unattributedWards: 0` fixos (`openDotaMatch.ts`): o toggle
  de mortes, `visionDeathsInEnemyVision` e `visionUnattributedWards` nunca aparecem.
- `analysisOutcome` é sempre `null`: `analysisOutcomeSource` ainda diz "Veredito da STRATZ".
- `posRoleUnknown` (`POSITION_ORDER` não tem `UNKNOWN`) e `fightsYouAbsent` (a OpenDota lista os
  10 jogadores em toda luta).
- `useHeroGridSync`: o ranking do catálogo inteiro no navegador é inalcançável pela UI.

## Texto cravado fora do `t()`

Os que mostravam português no en-US ou inglês no pt-BR saíram. Sobram jargão universal ou
símbolo, listados para quem quiser zerar:

- `TeamOverviewCard` ("vs"), `FightsTab` ("#" e "—" na célula vazia), `AdvantageTimeline` ("m" no
  eixo, ":00"), `QueueRankCard` ("—" num `title`), `ProfileHeader` ("ID:", "MMR").
- `CoachingInsightsTab`: "Pos " montado de `player.role`, que não é a posição efetiva do motor.
- `constants/baselines.ts`: `roleName` ("Carry (Pos 1)") fora do i18n.

## Tela

- **Partidas:** o selo "Derrota" repete o resultado que a linha já mostra; o título "Histórico de
  partidas" quebra em duas linhas e o filtro de texto cai para a fileira de baixo.
- **Partida recém-terminada:** agora abre o aviso genérico de falha. Uma mensagem própria
  ("a partida ainda está sendo processada") seria mais útil.
- `src/components/dashboard/CLAUDE.md` diz que o centro do gráfico de evolução é
  `GLINT_THRESHOLDS.neutral` "(48)"; o valor é 49, e a mediana medida é 45 (`GLINT_MEDIAN`).
  Decidir qual linha de referência o gráfico deve ter.
