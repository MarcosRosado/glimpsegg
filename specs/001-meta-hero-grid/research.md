# Phase 0 — Research: Layout espelho de heróis ordenado por winrate

**Feature**: `specs/001-meta-hero-grid` | **Data**: 2026-08-26

Tudo aqui foi verificado nesta sessão: requisições reais às fontes e leitura do
`hero_grid_config.json` real da máquina de desenvolvimento. Onde não deu para verificar (STRATZ
exige token pessoal), está marcado como **A VERIFICAR** com o procedimento.

> **Atualizado em 2026-08-26 pela sessão de clarificação.** Os três desvios do fim deste documento
> foram resolvidos e a spec foi alterada. O que mudou em relação ao que está escrito abaixo:
>
> | Item | Estado |
> | --- | --- |
> | **R4 — Dota 2 Pro Tracker** | **Fonte cortada da v1.** O achado continua registrado porque é a *justificativa* do corte: o download oficial dá ordem, não winrate com amostra |
> | **R5/R6 — precedência** | **Invertida para OpenDota → STRATZ.** A OpenDota não exige token; com o recorte por posição removido, as duas entregam a mesma coisa |
> | **R5 — argumento de posição** | **Não se aplica.** A query da STRATZ não passa `positionIds` |
> | **R13 — liberações de host** | **Não se aplica.** Sem D2PT, nenhum host novo, nenhum handler IPC de rede novo |
> | **D-1, D-2, D-3** | **Resolvidos.** Ver `spec.md § Clarifications` |
>
> As seções abaixo ficam como registro do que foi medido, não como especificação do que construir —
> para isso, `plan.md` e `contracts/` estão atualizados.

---

## R1 — Formato do arquivo de grids

**Decisão**: alvo é `hero_grid_config.json`, `version: 3`, com `configs: []` no topo. Cada config tem
`config_name` e `categories: []`. Cada categoria tem `category_name`, `x_position`, `y_position`,
`width`, `height`, `hero_ids: []`.

**Verificado** contra o arquivo real da máquina (`Layout1`, 8 categorias, 128 entradas / 127 heróis
únicos) e contra duas fontes independentes: o
[gist de referência 7.33](https://gist.github.com/Cyborgmatt/3b403178ee0b88bed2be9c523fbcb2b7) e o
[hauzer/dota-hero-grid-generator](https://github.com/hauzer/dota-hero-grid-generator).

**Consequência direta para o espelho**: `configs` é um **array de layouts**. O espelho é um elemento
novo nesse array. O objeto do layout de origem não precisa ser tocado — é o que torna FR-007
implementável de forma limpa, e não apenas uma promessa.

**Detalhe que importa**: a ordem dos heróis dentro de `hero_ids` **é** a ordem exibida no jogo. Ela é
o único campo que o espelho altera em relação à origem.

**Alternativas descartadas**: reescrever o config de origem no lugar (a estratégia anterior — o
usuário mudou de decisão, e o array de configs torna a alternativa segura trivial); usar o `source:
"stratz"` do d2grid (é config de uma ferramenta terceira, não do Dota).

---

## R2 — Caminho do arquivo e detecção de contas

**Decisão**: `<raiz do Steam>/userdata/<id3>/570/remote/cfg/hero_grid_config.json`.

Raízes candidatas, por plataforma:

| Plataforma | Candidatos |
| --- | --- |
| Linux | `~/.steam/steam`, `~/.steam/root`, `~/.local/share/Steam`, `~/.var/app/com.valvesoftware.Steam/.local/share/Steam` (Flatpak), `~/snap/steam/common/.local/share/Steam` (Snap) |
| Windows | registro `HKCU\Software\Valve\Steam\SteamPath`; fallback `C:\Program Files (x86)\Steam` |
| macOS | `~/Library/Application Support/Steam` |

**Três achados da máquina real, todos com consequência de código:**

1. **Deduplicar por `realpath`.** `~/.steam/steam`, `~/.steam/root` e `~/.local/share/Steam` são o
   *mesmo* diretório por symlink. Sem `realpath`, o app oferece a mesma conta três vezes.
2. **Filtrar pseudo-contas.** `userdata/` contém `0` e `anonymous` além do id3 real. Só entra
   diretório cujo nome é inteiro positivo.
3. **`cfg/` está no nível 5.** Uma busca `-maxdepth 4` não acha o arquivo — erro que cometi na
   primeira varredura desta pesquisa. A detecção deve montar o caminho, não varrer.

**Decisão sobre escolha de conta (FR-005)**: o app já guarda `steamAccountId`, que **é o id3**. Então
quando existir `userdata/<steamAccountId configurado>`, o app pré-seleciona essa conta e a escolha
manual fica como caminho secundário. Isso reduz a fricção de FR-005 sem violar FR-003 (a confirmação
explícita continua).

**Alternativa descartada**: ler `config/loginusers.vdf` para nomes de conta. Existe na máquina (230
bytes) mas exigiria um parser de VDF só para enfeitar um rótulo. Fica como melhoria futura.

---

## R3 — O arquivo pode não existir

**Decisão**: "arquivo ausente" é estado de primeira classe, não erro exótico.

O arquivo só passa a existir depois que o jogador monta um grid customizado no jogo. Um jogador que
nunca fez isso não tem o que espelhar. Nesse caso a feature **não** cria arquivo nem inventa layout:
ela explica que é preciso criar um grid no Dota primeiro (é a única fonte legítima de "o layout que
eu já possuo"), e oferece o campo de caminho manual de FR-006.

**Alternativa descartada**: gerar um layout inicial por atributo (Força/Agilidade/Int/Universal) para
ter algo a espelhar. Isso é a feature "criar layout do zero", explicitamente fora de escopo na spec.

---

## R4 — Dota 2 Pro Tracker: existe download oficial, e ele não dá winrate

> **RESOLVIDO: fonte cortada da v1** (clarificação de 2026-08-26). Esta seção fica como a
> justificativa técnica do corte.

Este é o achado que mais mexe no desenho.

**Verificado nesta sessão** (`curl`, HTTP 200, 50.364 bytes):
`https://dota2protracker.com/downloads/meta-hero-grid` devolve um **`hero_grid_config.json` pronto**,
com 6 configs (`All Roles` + um por posição) e uma categoria `All Heroes` contendo **todos os 127
heróis em ordem de meta** — não ordenada por id, confirmado.

**Decisão**: usar esse download como a integração D2PT da v1. É um recurso publicado pelo próprio
site para consumo por máquina, não raspagem de HTML.

**Mas**: ele entrega **ordem**, não winrate nem tamanho de amostra. Isso colide com FR-014/FR-015 da
spec, que assumem que toda fonte produz winrate + amostra. Ver **D-1** abaixo.

**Rota alternativa examinada e descartada para a v1**: `https://dota2protracker.com/meta` (HTTP 200,
2,0 MB) embute um payload de hidratação SvelteKit com, por herói e por posição, `matches`, `wins`,
`win_rate`, `contest_rate`, `d2pt_rating` e `position: "pos N"` — exatamente os números que FR-014
quer. **Descartado porque não é JSON**: são literais JavaScript com chaves sem aspas e floats sem
zero à esquerda (`win_rate:.5082458770614693`), dentro de um payload de framework. Parsear isso é
frágil por construção e quebra em qualquer troca de versão do SvelteKit. Fica documentado como
escotilha de saída, caso o usuário depois queira os números do D2PT.

**Sobre o User-Agent**: com UA padrão do `curl` → **HTTP 403**. Com `GlimpseGG_Dota2_Desktop/1.0` →
**HTTP 200**. Não é Cloudflare desafiando; é rejeição de UA vazio/genérico. O UA que o app já usa na
OpenDota serve.

**Sobre independência da fonte**: o próprio D2PT declara ser alimentado por dados da STRATZ. Então
D2PT não é uma terceira medição independente — é um recorte (7000+ MMR e pro) da mesma base. Isso
**não** o invalida, mas precisa estar no rótulo: "recorte alto MMR", não "fonte independente".

---

## R5 — STRATZ: winrate por bracket ~~e por posição~~

> **PARCIALMENTE SUPERADO** (clarificação de 2026-08-26): o recorte por posição saiu do escopo, então
> a query **não** passa `positionIds`. A verificação do argumento de bracket continua valendo e
> continua sendo a única incógnita de contrato aberta.

**Decisão**: `heroStats.winWeek` (ou `winMonth`) com `bracketIds` e `positionIds`, devolvendo
`heroId`, `matchCount`, `winCount`.

É a única das três fontes que dá winrate **por posição**, e posição muda o número drasticamente — o
que torna a STRATZ a fonte base preferencial. Vai pelo handler genérico `api:stratz-graphql` que já
existe: **nenhum host novo, nenhuma mudança de CSP, nenhum handler IPC novo**, exatamente como
`stratzHeroStats.ts` já faz.

**A VERIFICAR na implementação** (não deu para conferir aqui — a STRATZ exige o token pessoal, e não
vou tocar no token do usuário): o nome exato do argumento de bracket (`bracketIds` com
`RankBracketEnum` vs. `bracketBasicIds` com `RankBracketBasicEnum`, que é o que o projeto já usa em
`stratzHeroStats.ts`), e se `winWeek`/`winMonth` aceitam os dois. **Procedimento**: rodar a query com
o token, salvar a resposta anonimizada como fixture em `src/services/__fixtures__/`, e escrever o
mapper contra ela — o mesmo caminho que produziu `match-parsed.json` e o comentário do `winsAverage`
em `stratzHeroStats.ts`. Não assumir semântica de campo sem resposta real; o projeto já foi mordido
por isso.

**Alternativa descartada**: `heroStats.stats(...)`. Mais granular do que a feature precisa e mais caro.

---

## R6 — OpenDota: winrate por bracket, sem posição

> **PROMOVIDA A FONTE PRIMÁRIA** (clarificação de 2026-08-26). Deixou de ser "o piso da precedência"
> e passou a vir primeiro, porque não exige token e a feature precisa funcionar sem configuração.

**Verificado nesta sessão** (`GET /api/heroStats`, HTTP 200, 127 heróis, 60 campos):
`1_pick`/`1_win` … `8_pick`/`8_win` (buckets de rank tier, Herald→Immortal), `pub_pick`/`pub_win`,
`pro_pick`/`pro_win`/`pro_ban`, `turbo_*`. Público, sem chave.

**Decisão**: OpenDota é o piso da precedência — winrate por bracket, **sem** recorte de posição.
Serve para: (a) cobrir herói que a STRATZ não devolveu, (b) funcionar sem token, (c) ser a única
fonte quando o jogador não configurou a STRATZ. Já existe `fetchOpenDotaHeroStats()` em
`src/services/opendota.ts` — reaproveitar, não reescrever.

**Mapeamento de bucket → bracket do app**: os buckets 1..8 correspondem às medalhas Herald..Immortal,
e o app já tem `tierToBracket()` em `utils/rankBracket.ts` operando em tier. O agrupamento
`HERALD_GUARDIAN` = buckets 1–2, `CRUSADER_ARCHON` = 3–4, `LEGEND_ANCIENT` = 5–6,
`DIVINE_IMMORTAL` = 7–8 cai exatamente na mesma partição que `tierToBracket` já usa. Somar picks e
wins dos buckets do grupo.

---

## R7 — Desempenho pessoal do jogador

**Decisão**: `GET /api/players/{account_id}/heroes` da OpenDota — devolve, por herói, `games` e
`win` do jogador. Público, sem token, uma requisição, e o app já tem `steamAccountId` e o padrão de
chamada.

**Rationale**: FR-032 pede o histórico do perfil já configurado. Essa é a rota mais barata e a única
que não depende do token da STRATZ (que o jogador pode não ter configurado). Amostra pessoal por
herói é exatamente `games`, o que FR-032 manda exibir.

**Alternativa descartada**: derivar do histórico de partidas que o app já carrega. Cobre apenas as
partidas recentes buscadas, então a amostra sairia truncada e o número mentiria por baixo.

---

## R8 — Nota combinada e amostra pequena

**Decisão**: reaproveitar `src/utils/insights/wilson.ts` (`wilsonLowerBound`), que já existe no
projeto justamente para "não deixar amostra pequena virar recomendação confiante".

Forma da nota:

- Componente meta: `wilsonLowerBound(wins, matches)` da fonte que prevaleceu.
- Componente pessoal: `wilsonLowerBound(playerWins, playerGames)`.
- Peso do pessoal: cresce com `playerGames` e é desprezível em amostra mínima —
  `w = playerGames / (playerGames + K)`, com `K` constante de encolhimento documentada no topo do
  módulo, como manda a convenção de `constants/`.
- Nota final: `(1 - w) * meta + w * pessoal`.

**Por que Wilson e não winrate cru**: FR-019 e FR-030a pedem as duas proteções (amostra pequena no
meta e no pessoal) e o limite inferior de Wilson resolve as duas com uma função já testada
(`wilson.test.ts`). Zero dependência nova.

**FR-030b (decomposição obrigatória)** cai de graça: as duas parcelas e o `w` são exatamente os
valores intermediários do cálculo. A nota carrega os três.

---

## R9 — Onde a lógica mora: main vs renderer

**Decisão**: **toda** lógica pura em `src/` como TypeScript testável; `electron/` só faz I/O.

O renderer monta o objeto completo do arquivo de grids (origem intocada + espelho novo) e manda
pronto para o main gravar. O main expõe apenas: listar contas, ler arquivo, gravar arquivo (atômico,
com backup), restaurar backup, e responder se o Dota está rodando.

**Rationale**: antes desta feature, `vitest.config.ts` rodava com `include: ['src/**/*.test.ts']`
apenas — código em `electron/*.cjs` **não era testado por nada**. Esta feature toca um arquivo
insubstituível do usuário; deixar a lógica de montagem do espelho num arquivo fora do alcance dos
testes é exatamente o desenho que produziu o bug das quatro wards hardcoded que o `visionMapper.ts`
existe para consertar. A fronteira "main é I/O burro" mantém tudo que decide *o que* escrever sob
teste.

> **Correção de 2026-08-26, vinda do `/speckit-analyze`.** A regra acima estava certa, mas incompleta,
> e o plano se declarou em conformidade sem estar. Duas coisas **precisam** rodar no main e não podiam
> ficar sem teste: a guarda que compara os bytes antes de gravar (I-1, I-2) e a detecção de contas
> Steam com dedupe por `realpath` (I-25, I-26). A correção foi acrescentar
> `electron/**/*.test.cjs` ao `include` do `vitest.config.ts` — uma linha —, não mover a guarda para
> um lugar onde ela seria mais fraca. Regra revisada: **main é I/O burro, e o pouco que ele decide é
> testado onde ele decide.**

**Alternativas descartadas**: lógica no main com testes ad hoc (fora do gate do CI); compilar TS
separado para o main (peso de build desproporcional para uma feature).

---

## R10 — Agendamento diário

**Decisão**: agendador no renderer, com relógio de parede persistido, verificação periódica e
tolerância a salto de relógio. Sem daemon de sistema operacional, sem autostart.

- Persistir `lastSuccessfulSyncAt` (epoch ms) no config.
- Verificar a cada 5 min: `now - lastSuccessfulSyncAt >= 24h` → sincronizar (FR-024).
- Na abertura do app, mesma verificação: cobre "passou com o app fechado", **uma vez**, não uma por
  dia perdido (FR-023).
- `now - last < 0` (relógio andou para trás): **não** sincroniza e **não** reescreve o marcador —
  espera o relógio passar. Cobre FR-029 sem rajada e sem travar para sempre.

**Por que verificação periódica e não um `setTimeout` de 24h**: timer longo não sobrevive a
hibernação de forma confiável — dispara tarde ou não dispara. Comparar timestamps a cada 5 min é
imune a isso e é trivial de testar como função pura (`shouldSyncNow(lastAt, now)`).

**Consequência de escopo a registrar**: com o app fechado não há sincronização. Isso é exatamente o
que FR-023 descreve, mas é uma diferença real em relação ao MetaGrid, que instala autostart. Se o
jogador quiser "atualizado mesmo sem abrir o app", é feature nova (autostart / serviço), não coberta
por esta spec.

**Backoff de falha (FR-028)**: contador de falhas consecutivas persistido; espera
`min(30min * 2^falhas, 6h)`. Sucesso zera.

---

## R11 — Escrita segura

**Decisão**: quatro camadas, todas no main.

1. **Backup antes de gravar** (FR-009): copiar o arquivo original **byte a byte** para
   `hero_grid_config.glimpse.bak.<timestamp>` no mesmo diretório. Manter as N mais recentes (FR-037),
   apagar as demais.
2. **Escrita atômica** (FR-010): gravar em arquivo temporário no mesmo diretório, `fsync`, depois
   `rename` sobre o original. `rename` no mesmo sistema de arquivos é atômico — interrupção deixa o
   original intacto, nunca meio arquivo.
3. **Guarda de imutabilidade da origem** (FR-007): antes do `rename`, comparar o objeto do config de
   origem no conteúdo novo com o que foi lido. Diferente → **abortar sem gravar**. É a asserção que
   transforma FR-007 de intenção em garantia.
4. **Trava de escrita** (FR-012): um mutex em memória no main; segunda escrita concorrente é
   rejeitada, não enfileirada às cegas.

---

## R12 — Detectar Dota 2 em execução

**Decisão**: comparar o **nome do executável**, nunca substring de linha de comando.

- Linux/macOS: `ps -A -o comm=` e casar `comm` exatamente com `dota2`.
- Windows: `tasklist /FO CSV /NH` e casar a imagem exatamente com `dota2.exe`.

**Por que essa precisão**: durante esta pesquisa, `pgrep -a -f 'dota2|dota\.sh'` casou com o **próprio
shell** que executava o comando, porque o padrão aparecia na linha de comando. Um falso positivo
desses faria o app avisar "Dota 2 está aberto" para sempre. Casar `comm`/imagem elimina a classe.

**Alternativa descartada**: dependência nativa de enumeração de processos. Nenhuma dependência nova
se justifica aqui.

---

## R13 — ~~Liberações de host para o D2PT~~ (não se aplica)

> **SEM EFEITO** (clarificação de 2026-08-26): sem o D2PT, a feature não introduz host novo nem
> handler IPC de rede. Fica registrado o raciocínio, que vale para qualquer host futuro.

**Decisão**: só quando a fonte opcional estiver ligada, e em **dois** dos três lugares que o
`CLAUDE.md` lista:

- **Handler IPC novo** — obrigatório. `api:opendota-fetch` e `api:stratz-graphql` são presos a seus
  hosts; o D2PT precisa do seu (`api:d2pt-grid`), com UA explícito (ver R4).
- **CSP em `vite.config.ts`** — `connect-src` só é necessário se o **renderer** chamar direto. Como a
  chamada vai pelo IPC, **não** precisa. E não deve: o caminho browser (`npm run dev`) bateria em CORS
  de qualquer forma.
- **`EXTERNAL_HOST_ALLOWLIST`** — só se o app for oferecer um link para o site. Se a UI citar a fonte
  com link, entra; senão, não.

**Consequência**: a fonte opcional D2PT funciona **apenas no Electron**. No caminho browser ela fica
indisponível e rotulada como tal, o que já é coerente com a Assumption de que o modo navegador não
escreve layout.

---

## Desvios da spec — RESOLVIDOS em 2026-08-26

Três pontos onde a pesquisa contradisse uma premissa da spec. Todos decididos pelo autor na sessão de
clarificação e já aplicados na spec. O texto de cada um fica abaixo como registro do dilema.

| Desvio | Decisão |
| --- | --- |
| D-1 | **Opção B** — cortar o D2PT da v1. Só fontes com winrate e amostra |
| D-2 | **Opção A** — igualdade profunda da origem + backup byte-exato + serializador que preserva o estilo |
| D-3 | **Opção C** — ignorar posição. Winrate geral do herói em todos os grupos, rotulado |

Mais duas decisões da mesma sessão, que não eram desvios mas mudaram o desenho: precedência
**OpenDota → STRATZ**, e "processo em background" = **dentro do app**, sem autostart nem bandeja.

### D-1 — D2PT dá ordem, não winrate (FR-014, FR-015)

FR-014 exige que todo número usado na ordenação carregue fonte **e tamanho de amostra**. O download
oficial do D2PT não tem winrate nem amostra: tem posição na ordem (R4).

**Proposta**: acrescentar uma procedência `RANK_ONLY` ao vocabulário de fontes. Ela nunca produz
winrate exibido; entra como **critério de desempate e de destaque** entre heróis cujo intervalo de
confiança se sobrepõe, sempre rotulada como "ordem D2PT (sem amostra)". O winrate exibido continua
vindo sempre de STRATZ ou OpenDota. Alternativa: cortar D2PT da v1 e ganhar simplicidade.

### D-2 — "byte a byte" não é alcançável num round-trip de JSON (SC-003)

SC-003 pede que o layout de origem fique **byte a byte** idêntico. O arquivo real é serializado no
estilo da Valve: tabs, floats com 6 decimais, `[` em linha própria. Reescrever o arquivo com
`JSON.stringify` preserva o *conteúdo* da origem mas muda os *bytes* da serialização dela.

**Proposta**: a garantia passa a ser (a) o objeto do config de origem **igual em profundidade** ao
lido, verificado por asserção antes de gravar (R11.3), e (b) o backup **byte a byte** do arquivo
anterior, para o jogador sempre poder voltar ao arquivo exato. Além disso, escrever com um
serializador que imita o estilo da Valve, para o diff ficar mínimo e revisável — custo baixo,
testável, e evita que o arquivo pareça "reescrito por ferramenta".

### D-3 — Posição por grupo não é inferível (FR-034)

FR-034 supõe que dá para reconhecer a posição a partir do grupo. No grid real desta máquina os grupos
se chamam `Hcs Principais`, `Mids principais`, `Offs principais`, `Supps principais` e as versões
`Secundários`. É pt-BR, abreviado e com um eixo extra (principal/secundário) que não é posição.
Heurística de nome vai errar, e errar aqui troca o winrate de pos 1 pelo de pos 5 — o número muda
muito.

**Proposta**: o jogador **mapeia** cada grupo para uma posição na tela da feature, uma vez, com um
palpite inicial oferecido pelo app (e marcado como palpite). Grupo sem posição atribuída usa o
winrate geral do herói e é rotulado como tal, conforme FR-034 já manda para o caso de falha.

---

## Achado extra: herói em mais de um grupo

No grid real, 128 entradas para 127 heróis únicos — **um herói aparece em dois grupos**. O construtor
do espelho precisa tratar cada ocorrência de forma independente: o herói entra nos dois grupos do
espelho.

Com D-3 resolvido pela opção C (sem recorte por posição), ele recebe **a mesma nota nos dois grupos**
— o que simplifica o construtor, mas remove o que teria sido a vantagem do mapeamento manual: ordenar
o mesmo herói como pos 1 num grupo e pos 3 em outro.
