# Proposta — a régua própria do Glint

**Estado: proposta, 2026-11-21; leitura de "impactante" decidida no mesmo dia (A, §2); scripts da régua feitos, medida oficial à espera de partidas (§7).** Nada no app muda por causa deste arquivo: `glint.ts`, limiares,
tooltip e `fit-glint-experimental.cjs` ficam como estão até a régua ser aceita e medida.

Origem: decisão **D8** de [PLANO-OPENDOTA.md](PLANO-OPENDOTA.md) — "o Glint é uma medida nova e
não precisa ser 100% compatível com a STRATZ. É importante que ela seja impactante, mas pode ser
da própria forma". O aceite da Fase 4 (r ≥ 0,85 contra IMP + 50, etc.) media o quanto o Glint
imita o IMP. Sem o IMP como alvo, falta dizer **o que faz uma nota de impacto ser boa**. Este
documento propõe essa régua.

## 1. O que a medição exploratória mostrou

Números de uma passada exploratória (scripts descartáveis, não versionados) sobre o que estava em
`.gabarito/` em 2026-11-21: 2.573 partidas, 25.730 linhas de jogador (1.847 de 7.41, 726 de
7.42). **Não são a medida oficial** — o 7.42 já foi visto no ajuste e o 7.41 é o treino (ver §5).

| | Glint (pesos por papel) | Glint `any` (lista) | Média de 3 percentis (abates, mortes, assist.) | Média dos 8 percentis | IMP + 50 |
| --- | --- | --- | --- | --- | --- |
| Correlação com o Glint | — | 0,97 | **0,96** | 0,75 | 0,82 (o ajuste) |
| Time vencedor com média maior | 90,9% | 90,4% | 90,8% | 92,7% | 78% |
| Melhor da partida no time perdedor | 11% | — | 9% | 11% | 23–25% |
| Mediana por posição 1–5 | 44 45 42 49 49 | 47 47 45 44 43 | 53 54 51 48 48 | 58 60 55 45 45 | 42 43 43 47 47 |
| Correlação com a duração | 0,02 | — | 0,04 | 0,20–0,25 | 0,02 |
| Diferença mediana 1º–2º da partida | 5 (p25: 2) | — | 5,8 | 5,8 | 8 |
| 1º e 2º empatados na nota arredondada (a da tela) | 6,3% | 7,3% | 6,1% | 5,1% | 4,2% |

O que isso diz:

1. **O Glint de hoje é, quase inteiro, um percentil de abates, mortes e assistências.** A média
   simples desses três percentis tem correlação 0,96 com ele e separa vencedor de perdedor do
   mesmo jeito (AUC 0,882 contra 0,877). Os outros cinco percentis quase não mexem na nota — e
   ouro e dano entram com peso **negativo**, por colinearidade.
2. **Ele é mais preso ao resultado do que o IMP.** O melhor da partida sai do time perdedor em
   11% dos jogos (IMP: 23–25%). Não há taxa "certa" para isso; é a pergunta da §2.
3. **A calibração é o que ele faz bem.** Mediana parecida entre posições, nenhuma dependência de
   duração. A média ingênua dos oito percentis falha nos dois (cores ~15 pontos acima de
   suportes; r 0,20–0,25 com a duração).
4. **Os pesos `any` (lista de partidas) invertem a ordem por posição** — cores 47, suportes
   43–44 — enquanto os pesos por papel põem os suportes no topo. A mesma partida pode trocar de
   lado entre lista e detalhe.
5. **Sinais fora do modelo, dentro do mesmo time, não servem de régua crua.** Dano em torre,
   cura, stuns e wards correlacionam com o Glint entre −0,02 e 0,21, mas quase tudo é
   **posição** (wards puxam para o suporte). Cada time tem um jogador por posição, então dentro
   do time a comparação é sempre entre funções diferentes.
6. **Estabilidade do mesmo jogador não é medível hoje**: as partidas em disco não têm
   `account_id` (anônimas). Fica fora da régua até haver fonte.

## 2. O que "impactante" mede — decidido: A

**Decidido pelo dono em 2026-11-21: leitura A**, contribuição para a vitória — "acredito que a A
seja mais impactante; para o próprio Dota o MVP sempre vem do time que venceu". Consequências:
R6 fica só relatada (sem piso de "melhor no perdedor"), e a referência de R5 é a da §4. O MVP
do app já sai do time vencedor (superlativos, `awardEngine`) e continua assim; o maior Glint
pode, raramente, cair no time perdedor — Glint e MVP respondem perguntas diferentes.

A comparação que levou à decisão:

As duas leituras puxam a régua para lados opostos:

| | A. Contribuição para a vitória | B. Desempenho apesar do resultado |
| --- | --- | --- |
| Pergunta | "Quanto você moveu a partida a favor do seu time?" | "Quanto você jogou bem, ganhando ou perdendo?" |
| Relação com o resultado | Alta por construção (o time que venceu moveu mais) | Fraca de propósito |
| Melhor da partida no perdedor | Raro, mas possível (quem segurou lutas que o time perdeu) | Comum |
| Risco | Virar um detector de quem venceu | Elogiar estatística vazia (farm sem luta, KDA de quem fugiu) |

**Recomendação: A, medida por evento — não por placar final.** A nota responde "quanto você moveu
a partida", e a ligação com a vitória **aparece** em vez de ser imposta: abate que virou torre
vale mais do que abate no fim de uma luta perdida, e o suporte do time perdedor que ganhou as três
lutas do meio do jogo é creditado por elas. É o que separa "impacto" de "KDA bonito", e é
exatamente onde o Glint de hoje (um KDA percentil) é fraco. O MVP já cobre "quem decidiu o
resultado" por superlativos; o Glint ganha papel próprio medindo **influência** ao longo da
partida.

Se a escolha for B, a régua continua valendo; muda a referência da R5 (§3) e entra um piso para
"melhor da partida no perdedor".

## 3. A régua

Três exigências para cada critério, todas de propósito:

- **A nota atual tem de poder falhar nele.** Critério que tudo passa não é aceite.
- **Tem uma linha de base nomeada para bater**: a média de 3 percentis (abates, mortes,
  assistências) e a média dos 8. Se oito pesos ajustados não batem a média de três números, o
  modelo não merece a complexidade.
- **O limiar não sai do valor atual do Glint.** Sai de um princípio (quantil da própria escala,
  ruído de amostra) escrito **antes** da medida oficial.

Todos os critérios são medidos **duas vezes**: com os pesos por papel (detalhe da partida) e com
os pesos `any` (lista de partidas, partida não parseada).

| # | Critério | Limiar proposto | Por quê | Hoje (exploratório) |
| --- | --- | --- | --- | --- |
| R1 | **Calibração por posição** | A mediana de cada posição cai entre o p40 e o p60 da escala inteira | Uma posição não pode nascer 10 pontos de percentil acima de outra. É o teste para algum dia poder dizer "50 = esperado" | Glint 5/5 · `any` 5/5 · média de 8: 1/5 |
| R2 | **Calibração por herói** | ≥ 80% dos heróis com **200+** linhas com mediana entre p40 e p60 | Herói não pode dar nota sozinho. Com 40 linhas o erro da mediana (~3,6 pontos) é do tamanho da faixa, por isso o piso de 200 | Glint 98% de 51 heróis (7.41 + 7.42). Folgado para todas as candidatas: é guarda, não discrimina |
| R3 | **Independência da duração** | \|r\| ≤ 0,10 entre nota e duração | Partida longa não pode inflar nota (é o defeito de qualquer total por minuto) | Glint 0,02 · média de 8: 0,20–0,25 |
| R4 | **"Melhor" que se decide** | 1º e 2º da partida com a mesma nota arredondada (a que a tela mostra) em ≤ 10% das partidas | `TOP_CORE`/`TOP_SUPPORT` são slots fixos, sem margem: empate decidido no arredondamento não é destaque | Glint 6,3% (a primeira versão desta tabela dizia 12%, medido na nota sem arredondar) |
| R5 | **Concorda com a contribuição medida por evento**, dentro do mesmo time | Spearman médio dentro do time e "mesmo melhor do time" **acima** da média de 3 percentis, pelo limite inferior do IC95 | O critério de impacto propriamente dito (§4). Dentro do time, para tirar o resultado da conta | Depende da referência da §4 |
| R6 | **Relação com o resultado** | Só relatado. Com a leitura B, piso de "melhor no perdedor" a definir | Não há taxa certa (§1, item 2) | 90,9% · 11% |
| R7 | **IMP como sanidade** | Só relatado. Correlação abaixo de 0,5 exige explicação escrita antes de lançar | Divergir do IMP é permitido (D8); divergir sem saber por quê, não | r 0,82 · dentro do time 0,65 |
| R8 | **Lista e detalhe contam a mesma história** | Correlação ≥ 0,95 entre pesos por papel e `any` na mesma linha, **e** R1 passa nos dois | A mesma partida não pode trocar de lado entre telas | r 0,97, mas ordem por posição invertida (§1, item 4) |
| R9 *(desejável)* | **Composição explicável** | Pesos não negativos (ou componentes separados) | Só com isso o tooltip pode dizer o que puxou a nota, que a Fase 4 queria e hoje é proibido | Ouro e dano negativos (falha) |

**Fora da régua, declarado:** estabilidade do mesmo jogador (sem `account_id` no disco) e
monotonia por ranque (o percentil é por herói em todos os ranques; a nota sai quase plana de
Herald a Immortal e não há expectativa medida para comparar).

## 4. A referência de contribuição (R5): probabilidade de vitória por evento

R5 precisa de uma régua **de fora** das oito entradas do Glint, ou mede a si mesma. A proposta é
a técnica padrão de análise esportiva para "impacto": **probabilidade de vitória adicionada**.

1. **Modelo de probabilidade de vitória** a partir de `radiant_gold_adv` e `radiant_xp_adv` por
   minuto: P(vitória | vantagem de ouro, vantagem de xp, minuto). Ajustado no volume, sem a
   STRATZ. Vale para qualquer patch e é validado sozinho antes de servir de régua (calibração por
   decil e Brier, em partidas que não entraram no ajuste).
2. **Atribuição** de cada variação de probabilidade a quem a causou, com as fontes que a
   OpenDota já entrega na partida parseada (conferido: presentes em 200 de 200 partidas de
   volume):
   - `teamfights[]`: a variação de cada luta, dividida pela participação de cada jogador
     (dano, abates, mortes, `gold_delta` e `xp_delta` da luta);
   - `objectives[]` com `player_slot`: torres, Roshan, first blood;
   - entre eventos, o resto (farm, rotação silenciosa) dividido pela fatia de ouro e xp que
     cada jogador ganhou no intervalo.
3. **A régua é a fatia de cada jogador** no que o time moveu. A soma do time tende ao resultado,
   então R5 compara só **dentro do time**, onde o resultado é constante.

O que isso **é**: um segundo modelo, com hipóteses declaradas — não verdade de campo. Por isso
ele tem de passar na própria validação (passo 1) e mostrar quanto da variação total consegue
atribuir; o que não atribuir fica relatado, não espalhado.

O que isso **destrava**, se passar: um **alvo próprio** para ajustar o Glint no lugar do IMP. As
oito entradas continuam sendo percentis (é o que a lista de partidas tem), mas o alvo deixa de
depender da STRATZ — e então **todo o volume de 7.42 vira dado de treino**, sem esperar a STRATZ
conhecer o patch.

**Alternativa barata, complementar:** um painel cego — o dono marca o "mais impactante" de cada
time em ~60 partidas sem ver nota nenhuma, e R5 é medida também contra isso. Não escala, mas
diz se a referência por evento concorda com quem joga.

## 5. Protocolo

1. **Fechar a régua antes de medir.** O dono responde a §2; os limiares da §3 ficam escritos
   aqui antes de qualquer número oficial. Mexer em limiar depois de ver a medida é o que o
   projeto proíbe para o veredito de rota, e vale igual aqui.
2. **`scripts/measure-glint.cjs`** (novo, offline): R1–R9 para o Glint (pesos por papel e
   `any`), as duas linhas de base e o IMP onde houver, com IC95 onde o critério pede. Mesma
   disciplina dos outros scripts de medição: lê `.gabarito/`, nunca ajusta para passar.
3. **Referência de contribuição** (`scripts/build-impact-reference.cjs`, novo): modelo de
   probabilidade de vitória + atribuição, com a validação do passo 1 da §4 impressa.
4. **Conjunto da medida oficial: partidas de 7.42 colhidas a partir de 2026-11-22.** O 7.42 em
   disco hoje já foi olhado (é onde o Glint foi testado e onde esta proposta explorou), e o
   7.41 é o treino. A medida sai a partir de 500 partidas novas (o script se recusa abaixo
   disso); com a coleta agora só em 7.42, devem levar poucos dias.
5. **Resultado:**
   - o Glint atual passa → sai de "experimental"; o tooltip troca as métricas contra o IMP
     pelas da régua própria;
   - não passa (o esperado em R4 e R9, e provável em R5, já que hoje ele é um KDA percentil) →
     reajuste com o alvo próprio da §4 e nova medida em partidas ainda não vistas.

## 6. O que não muda

Peso e limiar saem de script, nunca do olho. Todo número de Glint sai com procedência e com o
rótulo enquanto for experimental. Percentil faltando ⇒ `null`. Nenhuma composição no tooltip
enquanto R9 não passar. Limiar se converte por quantil, não por soma.

## 7. Estado da implementação (2026-11-21)

Os passos 2 e 3 da §5 estão feitos; a medida oficial espera partidas.

- **`scripts/build-impact-reference.cjs`** + **`scripts/lib/impact.cjs`**: modelo de
  probabilidade de vitória e atribuição. **A referência passou na própria validação** (ajuste
  em 1.847 partidas de 7.41, validação em 726 de 7.42): log loss 0,548 contra 0,561 do modelo
  só de ouro com peso fixo e 0,693 da constante; maior desvio de calibração entre decis, 2,7
  pontos; acerta o lado vencedor em 65% no minuto 10, 73% no 20 e 79% no 30. Na atribuição,
  44% da variação de probabilidade cai em luta; o resíduo da linearização fora de luta é 11%
  dela. Descontada a média da posição, a contribuição correlaciona 0,66 com a média de 3
  percentis e 0,60 com o percentil de ouro/min — parecida com as entradas do Glint, mas não
  igual. Uma tentativa de fechar a conta escalando cada minuto foi descartada: a razão explode
  quando a soma linear fica perto de zero e a referência virou ruído (comentário em
  `lib/impact.cjs`).
- **`scripts/measure-glint.cjs`**: R1 a R9 para `glint`, `glint-any`, `kda3`, `media8` e `imp`.
  Medida oficial só com 7.42 fora de `.gabarito/glint-seen-2026-11-21.json` (as 2.573 partidas
  congeladas antes da coleta de 2026-11-21) e a partir de 500 partidas; `--explore` mede tudo
  e diz no topo que não decide nada. Roda na rotina diária, depois do critério de corte.

**Prévia exploratória** (`--explore`, 2.573 partidas, inclui treino e partidas já vistas — não é
a medida): o Glint atual **passa** R1, R2, R3, R4 e R8 e **falha** R5 e R9. Em R5 ele fica
**abaixo** da média de 3 percentis (Spearman dentro do time 0,362 contra 0,382; mesmo melhor do
time 35% contra 41%, IC95 da diferença inteiro abaixo de zero). O IMP fica ainda mais abaixo
(0,329; 34%).

**O reajuste contra o alvo próprio** (exploratório, script descartável: os oito percentis
ajustados à contribuição descontada da posição em 7.41, medidos em 7.42): Spearman 0,515 e mesmo
melhor do time em 50%, contra 0,384 e 41% da média de 3 percentis. É o caminho do passo 5 da §5.

**Ressalva que a medida oficial tem de carregar:** a referência credita ouro e xp ganhos fora
de luta, e abates e mortes em luta, então ela favorece **por construção** quem farma e quem
abate — e ouro/min e abates são entradas do Glint. Parte do ganho do reajuste é essa
afinidade. É a hipótese da leitura A ("ouro e xp no momento que pesa = impacto", que é a
premissa do modelo de probabilidade), declarada, não um defeito escondido; mas por isso R5 não
basta sozinha, e R1 (calibração por posição) segura o reajuste de virar "nota de farm".

**Conferências feitas antes de congelar a referência** (2026-11-21, antes de existir medida
oficial — depois dela, mexer na referência seria ajuste posterior, que a §5 proíbe):

- `teamfights[].players[i]` é `players[i]`: as 736.956 habilidades usadas em luta são todas do
  jogador do mesmo índice. 44% da referência depende disso.
- **Viés de posição em R5.** Descontar a média da posição centra a referência mas não iguala a
  dispersão (desvio de 0,18 na posição 1 contra 0,13 nas 4 e 5). O melhor do time pela
  referência, porém, se divide quase por igual entre as posições (22, 20, 18, 19 e 21%):
  não há tendência a coroar core. Fica só o desconto da média — padronizar por posição diria
  "relativo à função", e na leitura A o carry que move mais probabilidade teve mais impacto.

**Como ler o veredito.** R2 e R4 passam para todas as candidatas na prévia: são guardas, não
separam. Quem decide são R1, R3 (que reprovam a média de 8), R5 e R9. R2 sem amostra (menos de
10 heróis com 200+ linhas) sai `n/d` e **não conta como aprovação**: o veredito espera R2 medida.
O IC95 de R5 reamostra partidas, não times (os dois lados do mesmo jogo andam juntos).
