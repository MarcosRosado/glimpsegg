# Registro de validação

**Feature**: `specs/001-meta-hero-grid` | **Data**: 2026-08-27

O que foi executado, o que foi medido, e o que **falta** — com o motivo.

---

## Gates automáticos

| Gate | Resultado |
| --- | --- |
| `npm test` | **637 testes, 27 arquivos, verde** |
| `npm run build` (`tsc -b` + vite) | **verde**, 0 erro de tipo |
| `npx oxlint` | **0 achado nos arquivos da feature**; restam só os 6 avisos pré-existentes (`TeammatesMatrix`, `LanguageContext`, `generate-glimpse-icons`, 2 `catch` do `SettingsModal`) |
| `translations.test.ts` | 4/4 — paridade, nenhuma entrada vazia, mesmos placeholders, **nenhuma chave órfã** entre as 161 novas |
| Gate `_localeParity` | ativo, cobrindo as 161 chaves novas nos dois dicionários |

---

## Nível 1 — testes puros

Verde. Cobertura por módulo: `valveJson` 36 · `sourcePrecedence` 39 · `ranking` 36 ·
`mirrorBuilder` 34 · `gridFile` 38 · `syncScheduler` 45 · `heroGridBridge` 34 · `preferences` 30 ·
`stratzWinrates` 27 · `openDotaWinrates` 24 · `steamPaths` 22 · `settingsOptions` 21 ·
`tabFormat` 19 · `pathGuard` 17 · `dotaProcess` 17.

**Todas as invariantes I-1..I-27 têm teste nomeado.** Dois módulos foram verificados por *mutation
check* (neutralizar a asserção e confirmar que o teste fica vermelho): a guarda de imutabilidade de
`gridFile.cjs` (I-1/I-2) e a precedência de `sourcePrecedence.ts`.

## Nível 2 — fontes de dados

| Fonte | Medido |
| --- | --- |
| OpenDota `/heroStats` | 200, **127 heróis**, 60 campos, 160 KB. Buckets 1..8 presentes |
| OpenDota `/players/{id}/heroes` | 200, **127 linhas**. Campos reais: `hero_id`, `games`, **`win`** (não `wins`) |
| STRATZ `heroStats.winWeek` | 200 nos **6 brackets**, 127 linhas cada, zero duplicata por `heroId` |

**Achado que corrigiu o contrato**: o argumento é `bracketIds: [RankBracket]` (enum **por
medalha**), não `bracketBasicIds: [RankBracketBasicEnum]` como o plano supunha. Confirmado por
introspecção. As quatro faixas somam exatamente o `ALL` (66.387.160 partidas), então a partição é
completa e disjunta. Registrado em `contracts/meta-sources.md`.

Segunda medição registrada: nesta captura o **bucket 8 (Immortal) veio `0` para todos os 127
heróis** — por isso o teste de I-14 usa linhas sintéticas em vez da fixture.

## Nível 4 — a escrita, contra uma **cópia** do grid real

Executado como harness fora do repo (depende do `hero_grid_config.json` desta máquina, então como
teste commitado seria vermelho em qualquer CI). 5/5 verde:

| Verificação | Resultado |
| --- | --- |
| I-1 / SC-003 — origem igual em profundidade, mesma posição | OK |
| I-3 — `version` preservado | OK |
| I-4b / N-6 — espelho no fim de `configs`, layouts do jogador não se movem | OK |
| I-5, I-6 — nº de grupos, nomes e as 4 coordenadas idênticos | OK, nos 8 grupos |
| I-7 — mesmo conjunto e cardinalidade de `hero_ids` por grupo | OK, nos 8 grupos |
| E-1 / SC-004 — backup **byte a byte** igual ao original | OK (`Buffer.equals`) |
| E-3 — mutar a origem aborta com `SOURCE_MUTATED` e **não grava** | OK, arquivo inalterado |
| E-6 — poda mantém 5 backups | OK |
| **SC-003b / FR-008c — 30 sincronizações seguidas** | **exatamente 1 espelho**; origem ainda byte-idêntica depois de **31 escritas** |

### T073 — o diff, revisado

Uma sincronização sobre a cópia produz:

```
linhas adicionadas: 214
linhas removidas:     0
```

**Append puro.** As 215 linhas originais saem byte-idênticas — nenhuma re-indentação, nenhuma
reformatação. É a confirmação prática de FR-007c e do round-trip byte a byte do `valveJson.ts`.

## Nível 6 — agendamento

45 testes em `syncScheduler.test.ts`, todos com `now` injetado (o módulo é puro; há teste que lê o
próprio fonte e falha se alguém introduzir leitura de relógio interna). Cobre 23h59 / 24h01, app
reaberto após 3 dias devido **uma vez** (FR-023), relógio recuado sem reescrever o marcador
(FR-029), backoff com teto de 6h, e I-20 (`enabled: false` ⇒ `OFF`, sem timer e sem requisição).

## T070 — SC-009 (< 30s)

| Requisição | Morna | Pior caso visto |
| --- | --- | --- |
| OpenDota `/heroStats` (160 KB) | 655–987 ms | **20.130 ms** (cache frio do lado deles) |
| OpenDota `/players/{id}/heroes` | 1.211 ms | — |
| STRATZ `winWeek` | 506 ms | — |

**SC-009 OK.** Mesmo somando o pior caso das três dá 21,8s < 30s. Esta medição encontrou um defeito
real: o hook aguardava a STRATZ **antes** de disparar as outras duas, apesar de o comentário afirmar
paralelismo. Corrigido — as três saem num `Promise.all`, então o custo é ~a mais lenta e não a soma.

---

## O que FALTA (T066 parcial)

Não é possível executar sem interação humana com a máquina:

| Nível | Cenário | Por que falta |
| --- | --- | --- |
| 3 | Roteiro no app gráfico (6 passos) | Exige abrir o Electron e clicar; inclui limpar o token e recarregar |
| 4 | Contra o arquivo **real** | Exige escrever no `hero_grid_config.json` do jogador. Feito só contra cópia, por escolha de segurança |
| 5 | Dota 2 aberto | Exige abrir o jogo |
| 5 | Todas as fontes fora / uma fonte fora | Exige cortar a rede ou bloquear host |
| 5 | Sem permissão | Exige `chmod 444` num diretório |
| 5 | Colisão de nome / origem apagada | Exige criar e apagar layout dentro do Dota |
| 5 | Falso positivo de processo | Coberto por teste (`dotaProcess.test.cjs`), não verificado com o jogo real |

Os cenários do Nível 5 que **têm** cobertura equivalente em teste automatizado: guarda de
imutabilidade (`SOURCE_MUTATED`), arquivo ausente (L-1), JSON inválido (L-2), sem permissão (E-8),
colisão de nome (`NAME_COLLISION`), origem apagada (`SOURCE_INDEX_GONE`), Dota rodando
(`DOTA_RUNNING`) e falso positivo de processo (R12). O que falta é a confirmação de ponta a ponta
com o sistema real, não a lógica.

**O arquivo real nunca foi escrito.** sha256 no início e no fim:
`c9370156e5fdf5811304221f62f837d820b322964f17ffd660a1c6701f301baa`.
