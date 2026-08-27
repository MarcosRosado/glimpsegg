# Specification Quality Checklist: Ordenação do loadout de heróis por winrate do meta

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-26
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

16/16. Nenhum marcador em aberto.

### Sessão de clarificação — 2026-08-26 (5 perguntas, 5 respostas)

Rodada **depois** do `/speckit-plan`, porque foi a pesquisa da fase de plano que expôs as
contradições. Cada resposta está registrada em `spec.md § Clarifications` e já aplicada nos
requisitos.

| # | Pergunta | Decisão | Efeito |
| --- | --- | --- | --- |
| 1 | Como tratar dado sem amostra (D2PT dá ordem, não winrate)? | **Cortar o D2PT da v1** | FR-013a/b substituem FR-013a–d. Sai um módulo, um handler IPC, uma chave de config. Gate 1 da doutrina passa sem exceção |
| 2 | "Processo em background" precisa rodar com o app fechado? | **Só com o app aberto** | FR-022a e FR-024a novos. Sem autostart, bandeja ou headless — declarado fora de escopo |
| 3 | Como descobrir a posição de cada grupo do grid? | **Ignorar posição** | FR-034/034a/034b substituem FR-034. Sai um módulo, uma tela, uma chave de config |
| 4 | Qual fonte prevalece, agora que as duas entregam a mesma coisa? | **Inverter para OpenDota → STRATZ** | FR-015 reescrito, FR-015a novo: a feature funciona inteira sem token |
| 5 | Qual garantia no lugar de "byte a byte" em SC-003? | **Igualdade profunda + backup byte-exato** | FR-007b/007c e FR-009 reforçados; SC-003 e SC-004 reescritos |

**Decisões que rebaixam escopo declarado, para ficar visível em review:**

- O Dota 2 Pro Tracker estava no pedido original e **saiu**. A feature não responde "o que os pros
  estão jogando" — responde "o que ganha no meu ranque". Registrado em R-001.
- O recorte por função **saiu**. A ordem dentro do grupo de suportes reflete a força geral do herói,
  não a força dele como suporte. FR-034b obriga a tela a dizer isso.
- Nada roda com o app fechado. Quem não abre o GlimpseGG por uma semana pega o espelho da semana
  passada, e FR-024a obriga a tela a mostrar quantos dias se passaram.

### Notas de revisão

- As fontes de dados (OpenDota, STRATZ) e o arquivo de grids do Dota 2 são dependências externas do
  domínio, nomeadas pelo próprio pedido — não escolhas de implementação. Por isso permanecem nos
  requisitos.
- Caminhos de sistema, nome de arquivo e protocolo de rede seguem fora dos FRs; o que existe sobre
  eles está em Assumptions e em `contracts/`.
- Único item na fronteira do "sem detalhe de implementação": SC-004 fala em conferir o backup por
  hash. É método de verificação, não escolha de tecnologia — mantido.
- Ponto de atenção para o `/speckit-tasks`: mesmo com a estratégia de espelho, a escrita acontece no
  **mesmo arquivo** que guarda os layouts feitos à mão, e o cliente do Dota o reescreve ao sair
  (R-002, R-003). Backup byte-exato da coleção, escrita atômica, asserção de igualdade profunda da
  origem (FR-007b) e detecção de jogo em execução não são opcionais.
- Segundo ponto: o espelho precisa ser **idempotente** (FR-008c) e **re-espelhar** a estrutura quando
  a origem muda (FR-008d, R-002a). Sem isso a feature acumula layouts ou serve um grid que não
  corresponde mais ao do jogador.
- Incógnita de contrato ainda aberta (não bloqueia a spec): nome do argumento de bracket na STRATZ,
  `bracketBasicIds` vs `bracketIds`. Precisa do token para confirmar; procedimento em
  `contracts/meta-sources.md`.

### Rodada de `/speckit-analyze` — 2026-08-26 (14 achados, todos corrigidos)

A análise rodou depois do `/speckit-tasks` e encontrou **1 CRITICAL**, 4 HIGH, 5 MEDIUM e 4 LOW. Todos
foram corrigidos na mesma sessão, a pedido do autor.

| Achado | O que estava errado | Correção |
| --- | --- | --- |
| **D1** (CRITICAL) | A guarda que impede alterar o layout do jogador (I-1, I-2) e a detecção de contas Steam (I-25, I-26) moram em `electron/*.cjs`, que o `include` do vitest não cobria. O `plan.md` declarou o Gate 6 como PASS com base numa fronteira que as tarefas não respeitavam — a propriedade mais importante da feature era a única sem teste | `vitest.config.ts` passou a incluir `electron/**/*.test.cjs`; T007 e T018 são as tarefas de teste novas. Gate 6 reescrito para dizer a verdade sobre o que aconteceu |
| **C1** (HIGH) | FR-006 (caminho manual) sem tarefa nenhuma — feature inutilizável em Steam fora do padrão | T031 |
| **C2** (HIGH) | FR-008d (re-espelhar quando a origem muda) sem implementação nem teste, apesar de ser o risco R-002a que o próprio plano levantou | T019 (teste) e T024 (implementação) |
| **C3** (HIGH) | FR-008g: a remoção do espelho tinha botão, não tinha caminho de escrita. Remover é uma escrita, com backup e atomicidade | T034 |
| **C4** (HIGH) | T020 não usava `statsCache`, então o `plan.md` prometia "morno: 0 requests" enquanto a feature rebaixaria 164 KB por abertura, e FR-021 ficava meio coberto | Cache com a chave do contrato acrescentado a T020 |
| **C5/C6** (MEDIUM) | FR-035a e FR-035b não apareciam em nenhuma tarefa de UI: `outsideSource` era produzido e nunca exibido | Acrescentados a T032 |
| **C7** (MEDIUM) | FR-004: o fluxo de *desmarcar* não ligava o toggle à remoção do espelho | T035 |
| **C8** (MEDIUM) | I-3, I-4 e I-27 sem tarefa de teste | Acrescentados a T013, T016 e T007 |
| **I1** (MEDIUM) | `plan.md` usava "Fase A/B/C" e `tasks.md` "Phase 1..7" — duas nomenclaturas para a mesma feature | Fases do plano renomeadas para casar com as tarefas |
| **U1** (MEDIUM) | A constante `K` do peso pessoal não tinha valor em lugar nenhum, e ela governa o critério **padrão** | `K = 20` fixado com tabela da curva em `contracts/meta-sources.md § 4` e no T022 |
| **P1** (novo, MEDIUM) | Detectado na verificação: 4 tarefas marcadas como paralelas editavam arquivos de teste criados por outra tarefa da mesma fase (T017, T019, T039, T048) | Marcador removido das quatro, com a regra explicitada na seção de paralelismo |
| **L2** (LOW) | FR-007a aparecia depois de FR-007b/c | Reordenado |
| **L1/L3** (LOW) | Requisitos negativos sem tarefa de verificação; sobreposição deliberada entre FR-034 e FR-034a | Sem ação; anotados para não parecerem omissão |

**Estado depois das correções**: 70 tarefas (eram 63), **27/27 invariantes com tarefa de teste**
(eram 20/27), e os 4 FRs construíveis que estavam com zero tarefa agora têm cobertura. Zero conflito
de paralelismo. `npm test` (198 testes), `npm run build` e `npx oxlint` verdes com o `include` novo.

**Lição que vale registrar**: o CRITICAL não foi um requisito esquecido — foi um gate que o plano
declarou cumprido sem estar. Vale desconfiar de tabela de conformidade preenchida pela mesma pessoa
que desenhou a solução.

### Revisão de generalidade — 2026-08-26 (pergunta do autor: "funciona para qualquer organização de grupos?")

A ordenação já era agnóstica por construção — copia a categoria e só reordena a lista, sem interpretar
o significado de grupo nenhum. Foi a decisão da Q3 (ignorar posição) que comprou isso. Mas a revisão
encontrou **três acoplamentos ao grid do autor**, todos corrigidos:

| Problema | Por que importava | Correção |
| --- | --- | --- |
| **Identidade por nome.** Origem e espelho eram guardados como `config_name`; categoria era referenciada por `category_name` | O Dota permite dois layouts de mesmo nome, dois grupos de mesmo nome, e renomear a qualquer momento. Renomear o espelho no jogo faria o app perder o rastro e criar um segundo, violando FR-008c | FR-008h e FR-008i novos; identidade passa a ser **posição no array**, nome vira rótulo. Regras N-1 a N-7 em `contracts/hero-grid-file.md`; `ConfigRef` no data-model; `writeFile` recebe índices e `expectedConfigCount` |
| **Nomes repetidos não tratados em lugar nenhum** | Não é hipótese: o grid de meta publicado pelo próprio D2PT repete `Best with` **sete vezes** num único layout. O grid do autor não tem nenhum, então nada na spec mencionava o caso | I-4a; casos de borda novos; teste em T021 |
| **Fixture de um único layout torna I-2 intestável** | O grid do autor tem só `Layout1`. "Não altere nenhum outro layout" (FR-007a, I-2) passaria **vazio** — quem tem vários layouts confiaria numa garantia sem teste | Anti-fixture `hero-grid-adverse.json` (T003) e T021, mais um passo no `quickstart.md` pedindo um segundo layout na máquina |

Também registrado: o grid do autor contém o catálogo inteiro de heróis, então o caminho de FR-035a
("herói fora do layout de origem") é conjunto vazio para ele — e é o caminho que a maioria dos
jogadores encontra o tempo todo. Virou caso de borda explícito e item do critério de pronto.

**Estado**: 73 tarefas (eram 70), 63 FRs, 16 SCs. Duas fixtures deliberadamente opostas — uma prova
que funciona para o autor, a outra que funciona para os demais. Zero conflito de paralelismo.

**Lição**: "funciona na minha máquina" e "funciona para qualquer um" divergiram exatamente onde o
dado do autor era atípico — layout único e sem nomes repetidos. A fixture que mais protege é a que
não se parece com o caso real disponível.

- Mark items `[x]` only after review confirms the requirement-quality criterion is satisfied
