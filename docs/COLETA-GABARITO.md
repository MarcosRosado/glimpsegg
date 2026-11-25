# Coleta do gabarito — roteiro do dia a dia

O que rodar, em que ordem e o que olhar para ir agregando os dados de
[PLANO-OPENDOTA.md](PLANO-OPENDOTA.md). Este arquivo é o **como**; o plano é o **porquê** e o
estado. Tudo roda da raiz do repositório e grava em `.gabarito/`, que está fora do git e do app
(decisão D5).

**Por que não pode esperar:** a STRATZ é o gabarito e está se degradando. Ela não conhece o 7.42
(marca tudo como 7.41f), e o IMP já falta em parte das partidas. Cada dia sem coleta é rótulo que
não volta. A OpenDota, por outro lado, só libera 3.000 chamadas por dia sem chave — a coleta é
uma corrida curta todo dia, não um job que se deixa rodando uma vez.

## De onde vem o token

Os scripts de coleta são agora a **única** coisa que fala com a STRATZ: o app parou de usá-la
em 2026-11-19 e não pede nem grava token. `scripts/lib/sources.cjs` procura o token em
`STRATZ_API_KEY`, depois em `.gabarito/.stratz-token` (um arquivo de uma linha, fora do git) e
por último na chave `stratzApiKey` que tenha sobrado no config do app. Nesta máquina a chave
antiga continua no config e a coleta segue funcionando; para não depender disso, grave o token
em `.gabarito/.stratz-token` (`chmod 600`). Nenhum script copia o token por você.

## A rotina (uma vez por dia)

A cota da OpenDota zera à meia-noite UTC (21h de Brasília). Um coletor por vez — o script se
recusa a abrir o segundo.

```bash
# 1. Como está
node scripts/collect-pairs.cjs --status

# 2. Colher até a cota do dia acabar (para sozinho, com 150 chamadas de reserva).
#    Só a trilha 7.42a desde 2026-11-25 (a 7.42 parou em partidas de 19/11 e a 7.41 em
#    2026-11-21 — ver "Trilha 7.42a" e "Prioridade da cota"). Sem --lane, é a mais nova:
node scripts/collect-pairs.cjs

# 3. Medir (offline, não gasta cota)
node scripts/accept-phase1.cjs          # aceite da Fase 1 sobre os pares
node scripts/benchmark-coverage.cjs     # critério de corte + curva própria; grava no histórico
node scripts/build-benchmarks.cjs       # regrava as curvas próprias (Fase 2)
```

Interromper com Ctrl+C é seguro: o coletor termina a partida atual, grava o índice e retoma
depois do mesmo ponto.

**Prioridade da cota**, enquanto as duas APIs responderem:

1. **Pares de 7.42** — o conjunto de teste, e as células de partida curta que faltam para o
   aceite da Fase 1 (ele soma os dois patches).
2. **Volume de 7.42** — vem de graça junto: partida que passa na triagem e cai em célula de par já cheia
   é gravada só com a metade OpenDota em `.gabarito/matches/`. Quando as células de par enchem,
   a cota inteira do dia vira volume, que é o que alimenta os benchmarks próprios (Fase 2).

**A trilha 7.41 parou em 2026-11-21** (decisão do dono). Ela levava metade da cota e já não
rendia: as células de 25–40 e 40+ min estavam no teto de 90; faltavam só as de menos de 25 min,
raras (a de Herald, com 5 pares, não chegaria a 50 antes do fim da janela); o Glint e o
veredito de rota não mudavam com mais treino (Glint de 823 para 916 partidas: r 0,81 → 0,82); e
o que ela colhia era quase só volume de 7.41 (742 de volume para 106 pares no último dia), curva
de um patch que o app não usa. Os 985 pares de 7.41 em disco **continuam sendo o treino** — são
os rótulos limpos: a STRATZ marca a 7.42 como 7.41f, então o IMP dela nas partidas de 7.42
provavelmente sai contra o 7.41. Voltar a colher 7.41 é decisão, à mão, com
`node scripts/collect-pairs.cjs --lane 7.41`.

## Trilha 7.42a (desde 2026-11-25)

A 7.42a saiu em 2026-11-24 (notícia da Steam às 23:39 UTC). A OpenDota grava o **mesmo**
`patch` (61) nas duas e não lista a 7.42a em `/constants/patch`, então o patch de letra sai do
horário de início, em `scripts/lib/patches.cjs`: 7.42a é partida que começou depois da notícia
**mais 2 horas** (na 7.42, notícia e virada da OpenDota divergiram em 1h27; a folga só perde
partida, nunca põe 7.42 dentro da 7.42a). O `patch_timestamp` do datafeed da Valve não serve —
é marcador de data, sempre 08:00 UTC.

A trilha 7.42 tinha descido até partidas de 19/11 e nunca chegaria à 7.42a, então a rotina
passou a colher **só a 7.42a**, do topo para baixo (decisão do dono em 2026-11-24, "pode
atualizar para a nova versão"). O cursor da 7.42 fica onde parou (`--lane 7.42` retoma, à mão);
o nível 1 do critério de corte em 7.42 já estava em 65,8%. Desde então, par e volume guardam
`start` no índice, que é de onde o patch de letra sai ao recarregar.

O que a 7.42a muda nas medidas: `measure-glint.cjs --patch 7.42a` mede só ela (seção "Glint no
ar (v5.1) só em 7.42a" do log, a partir de 500 partidas). Os outros relatórios — aceite, critério
de corte, benchmarks próprios, referência de contribuição e a medida oficial sem `--patch` — leem o
`patch` da OpenDota e contam a 7.42a **dentro** de "7.42". Para o aceite da Fase 1 isso é
indiferente; para as curvas próprias da Fase 2, é mistura de dois balanceamentos no mesmo patch,
a mesma que os agregados da OpenDota fazem.

## Agendamento (a rotina sozinha, todo dia das 17h00 às 20h57)

`scripts/collect-daily.sh` faz a rotina acima sem ninguém: colhe 7.42a até o saldo do dia chegar
em `APP_RESERVE`, roda o aceite e o critério de corte, e grava tudo em
`.gabarito/logs/AAAA-MM-DD.log`. Quatro limites, todos de propósito:

- **`UNTIL_TIME`** (opcional; no agendamento, `20:57`): hora local em que a coleta **para**. A
  rotina fecha o dia gastando a **sobra** da cota, logo antes de ela zerar (meia-noite UTC =
  21h): a cota fica para o app, e o que ele não usou vira coleta. O coletor já
  lê o saldo nos cabeçalhos e para na reserva; o horário existe porque, passada a virada, o saldo
  volta a 3.000 e a coleta começaria a gastar a cota do dia seguinte. A trilha vai até a
  hora de parada. Decisão do dono em 2026-11-19, depois de um
  dia em que coleta, medições e conferência do app no mesmo IP esgotaram a cota às 17h.
- **`APP_RESERVE`** (no agendamento, `500`; padrão 150, o mínimo do coletor): saldo do dia que
  a coleta deixa intocado. A coleta roda junto com o uso da noite, e 500 cobrem várias
  sessões do app (perfil ~5 chamadas mais uma tabela de percentil por herói, com cache de 7 dias;
  cada partida aberta, 1).
- **`WINDOW_MINUTES`** (no agendamento, `240`): a maior janela aceita. Com `UNTIL_TIME`, a rotina
  que começar a mais de `WINDOW_MINUTES` minutos da hora de parada (ou depois dela) não colhe —
  máquina ligada de manhã nunca dispara uma coleta de doze horas sobre a cota nova. Sem
  `UNTIL_TIME`, é a duração da coleta (padrão 180). O encerramento é um Ctrl+C: o coletor termina
  a partida atual e grava o índice.
- **`GABARITO_UNTIL`** (obrigatório): último dia em que ainda colhe. Depois dele o script só
  escreve no log que a janela acabou. Coleta sem data de fim gasta cota de terceiros e enche o
  disco sem ninguém olhar — continuar tem de ser decisão, não inércia.

Quem dispara é um temporizador de usuário do systemd, que mora **fora do repositório**, em
`~/.config/systemd/user/glimpsegg-gabarito.{service,timer}` (instalado em 2026-11-19, com
`GABARITO_UNTIL=2026-12-03`; às 17h00, com `UNTIL_TIME=20:57`, `WINDOW_MINUTES=240` e
`APP_RESERVE=500`, desde o mesmo dia — antes era às 15h, gastando até 2.850 chamadas). O `.service` leva o caminho do repositório e o do `node`, então é
arquivo da máquina, não do projeto.

**Por que 17h:** pares andam a ~11 chamadas por minuto (o freio de 4,5 s entre pares é o limite
horário do token da STRATZ), e a sobra de um dia sem uso é de até ~2.500 chamadas acima da
reserva: ~4 horas. Enquanto as células de 7.42 estiverem abaixo de 50, é quase tudo par. Quando
encherem, a coleta vira volume (uma chamada da OpenDota por partida, ~55 por minuto) e o início
pode ir para mais tarde.

```bash
systemctl --user list-timers glimpsegg-gabarito.timer     # próxima execução
systemctl --user start glimpsegg-gabarito.service         # rodar agora (só colhe entre 16h57 e 20h57)
journalctl --user -u glimpsegg-gabarito.service -n 20     # se o serviço nem chegou a escrever log
tail -40 .gabarito/logs/$(date +%F).log                   # o que a rotina fez hoje
systemctl --user edit --full glimpsegg-gabarito.service   # mudar GABARITO_UNTIL ou a janela
systemctl --user disable --now glimpsegg-gabarito.timer   # desligar
```

Três coisas para saber: o temporizador só roda com a sessão do usuário aberta (não há *linger*);
com a máquina desligada às 17h, **não** roda ao ligar (sem `Persistent`: seria sobre a cota
nova, a do app); e se o `node`
mudar de versão pelo fnm, o `PATH` do `.service` precisa ser atualizado. Se já houver um coletor
rodando à mão, o agendado se recusa a abrir o segundo e segue para os relatórios.

## O que cada pasta guarda

| Onde | O quê | Quem escreve | Tamanho |
| --- | --- | --- | --- |
| `.gabarito/pairs/<id>.json.gz` | Par rotulado `{ od, st, gen }`: OpenDota crua, partida da STRATZ, insumos do IMP por minuto | `collect-pairs.cjs` | ~45 KB por partida |
| `.gabarito/pairs/index.json` | Estrato, patch e cursor de cada trilha; lista do volume | `collect-pairs.cjs` | — |
| `.gabarito/matches/<id>.json.gz` | Volume `{ od }`: só a OpenDota, sem rótulo | `collect-pairs.cjs` | ~40 KB por partida |
| `.gabarito/hero-stats/<data>/` | Fotografia de `heroStats.stats` (uma semana de 7.41) | `snapshot-hero-stats.cjs` | 210 MB |
| `.gabarito/benchmarks/<patch>.json` | As curvas próprias por minuto, com quantis. **Derivado**: regravado a cada execução, a fonte de verdade são as partidas | `build-benchmarks.cjs` | cresce com as células |
| `.gabarito/coverage-log.jsonl` | Uma linha por execução do `benchmark-coverage.cjs` | `benchmark-coverage.cjs` | — |
| `.gabarito/pairs-2026-11-19.json`, `control-sample-2026-11-19.json` | As amostras que produziram o §1 do plano. **Não apagar nem sobrescrever** | (coleta manual) | — |

Conta de disco: 30 mil partidas de volume são cerca de 1,2 GB. Nada disso tem cópia — vale um
backup da pasta de vez em quando.

## O critério de corte, agora contínuo

O plano original dizia "em 14 dias, se menos de 60% das linhas de jogador caírem em célula com
amostra suficiente, o benchmark próprio não se sustenta". Em 2026-11-19 isso virou **medida
contínua**: não há data de prova. `benchmark-coverage.cjs` mede a mesma coisa sobre o que
estiver em disco e grava uma linha no histórico a cada execução.

```bash
node scripts/benchmark-coverage.cjs              # mede e grava no histórico
node scripts/benchmark-coverage.cjs --history    # a série, para ver a tendência
node scripts/benchmark-coverage.cjs --min-cell 50   # explora com piso menor (não entra no histórico)
```

O que ler:

- **`CRITERIO DE CORTE`** — fatia das linhas em célula herói × posição com 200+ linhas (nível 1)
  e a fatia que só se salva em herói × core/suporte (nível 2). A referência continua sendo 60%.
- **A tendência, não o ponto.** A pergunta deixou de ser "passou em 14 dias?" e passou a ser
  "no ritmo de volume que dá para manter, quando chega em 60%?". Se a série do `--history`
  achatar bem abaixo disso com semanas de coleta, é a resposta da D6 (chave paga) ou o sinal de
  parar na Fase 1.
- **`CURVA PROPRIA x FOTOGRAFIA`** — prévia do aceite da Fase 2 (erro abaixo de 5% em patrimônio
  e cs nos minutos 10, 20 e 30), só para 7.41. Sai nos dois alinhamentos de minuto; o de menor
  erro é o que vale. Com piso de exploração baixo o número é ruído — serve para ver o lado, não
  para decidir.

Quando olhar: não há calendário. Um bom ritmo é rodar depois de cada dia de coleta (custa
segundos) e **ler** a série uma vez por semana.

## Sinais de que algo quebrou

| O que aparece | O que significa | O que fazer |
| --- | --- | --- |
| `triagem pela STRATZ voltou vazia` ou `indisponivel` em toda página | A STRATZ parou de responder à triagem. O coletor segue, mas paga uma chamada por candidata (rende ~40% em vez de ~90%) | Conferir com `node scripts/check-patch-readiness.cjs`. Se a STRATZ caiu de vez, acabaram os pares: o que está em disco é o gabarito final |
| `com IMP nos 10 jogadores` caindo em relação ao total | A STRATZ está deixando de calcular IMP | Priorizar ainda mais os pares; anotar a data no §7 do plano |
| `STRATZ HTTP 429` | Limite do token (o script já segura 4,5 s por par) | Esperar uma hora e retomar |
| `OpenDota 429 em ... esperando N s` | Limite da OpenDota com saldo no dia. Desde 2026-11-22 o coletor espera e repete a mesma chamada (até 4 tentativas) | Nada. Ler o `saldo minuto`: **0** com o coletor bem abaixo de 60/min = outro cliente no mesmo IP (o app aberto); minuto **e** dia com saldo = limite do lado da OpenDota |
| `limite de chamadas atingido: parando (saldo minuto ...)` | O 429 resistiu às 4 tentativas, ou veio da STRATZ | O cursor voltou para a partida do 429; a próxima execução retoma dela. Se repetir todo dia com saldo alto, anotar os saldos no §7 do plano |
| `OpenDota HTTP 500` avulso | Partida que a OpenDota não consegue servir | Nada: conta como `erro` e segue. Cinco seguidos param o script |
| `a trilha 7.42a chegou ao patch anterior` (ou outra trilha) | A paginação desceu até a virada | Acabou o que havia abaixo do ponto de partida da trilha. A 7.41 está parada de propósito (2026-11-21) e a 7.42 desde 2026-11-24; partida mais nova que o início da trilha não é colhida — decidir antes de mexer no cursor |
| Célula que não sai do zero por dias (partida curta, Herald/Guardian) | Raridade real em `/parsedMatches` | Ver "Células raras" abaixo |
| `accept-phase1.cjs` com divergência nova fora de posição | Bug do mapper ou mudança de API | Investigar o par listado; **não** ajustar o mapper só para passar |

## Células raras

Partida com menos de 25 minutos e a faixa Herald/Guardian aparecem pouco em `/parsedMatches`
(parse na OpenDota é em boa parte pedido, e quem pede joga mais alto). A triagem torna a busca
barata — uma chamada da OpenDota varre 100 candidatas — então, com as células comuns cheias, a
cota passa a servir às raras. Mesmo assim é possível que alguma nunca chegue a 50. Nesse caso
o caminho honesto é o do §5 do plano: reportar o estrato com o **n ao lado** e não fechar
aceite nele, em vez de baixar a régua em silêncio.

## Quando esta rotina acaba

- **Pares:** quando as 15 células dos dois patches chegarem a 50 (ou quando a STRATZ parar de
  responder — o que vier primeiro).
- **Volume:** não acaba enquanto houver benchmark próprio; a cada patch novo a base recomeça.
  O que muda na Fase 2 é o destino: de `.gabarito/` local para um workflow agendado que publica
  o agregado num branch de dados. Isso depende da D6 e do que a série de cobertura mostrar.
