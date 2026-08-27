# Quickstart — validação de ponta a ponta

**Feature**: `specs/001-meta-hero-grid` | **Date**: 2026-08-26

Como provar que a feature funciona e, principalmente, que ela **não** estraga o layout do jogador.
Guia de validação — implementação vai em `tasks.md`.

---

## Antes de tudo: proteja o arquivo real

O `hero_grid_config.json` da sua máquina é trabalho manual e não está em nenhum outro lugar. Antes de
rodar qualquer coisa que escreva:

```bash
GRID="$HOME/.steam/steam/userdata/86738327/570/remote/cfg/hero_grid_config.json"
cp -av "$GRID" "$HOME/hero_grid_config.json.MANUAL-BACKUP-$(date +%Y%m%d-%H%M%S)"
sha256sum "$GRID"          # anote: é o seu critério de "consigo voltar ao arquivo exato"
```

Guarde esse sha256. Ele é a verificação de **SC-004** (o backup devolve o arquivo byte a byte).
SC-003 é outra coisa: o *layout de origem* fica igual em profundidade, verificado por asserção antes
de gravar — a formatação do arquivo inteiro muda, e isso é esperado (FR-007c).

---

## Pré-requisitos

| Item | Como conferir |
| --- | --- |
| Node + deps | `npm ci` |
| Grid existente | O arquivo acima precisa existir. Se não existe, crie um layout no Dota 2 primeiro — a feature não cria layout (R3) |
| Um segundo layout | Para validar I-2 no mundo real, crie um segundo layout qualquer no Dota antes do Nível 4. Sem ele, "não alterou os outros" não é verificável na sua máquina |
| Token STRATZ | **Opcional.** A feature funciona inteira sem ele (FR-015a). Rodar sem token é um caso obrigatório de teste, não um caminho degradado de exceção |
| Dota 2 **fechado** | Para os cenários de escrita. Um cenário testa justamente com ele aberto |

---

## Nível 1 — testes puros (sem tocar em arquivo, sem rede)

O grosso da confiança mora aqui. Tudo em `src/`, `environment: 'node'`.

```bash
npm test                                              # suíte inteira
npx vitest run src/utils/heroGrid/                    # só a feature
npx vitest run -t "espelho preserva a origem"         # por nome
npx oxlint
npm run build                                         # tsc -b: os gates de tipo moram aqui
```

**Esperado**: verde. `npm run build` falhando por chave i18n faltando em `en-US` é o gate
`_localeParity` funcionando — corrigir o dicionário, não silenciar.

Invariantes que precisam existir como teste nomeado (ver [data-model.md](./data-model.md)):

| Invariante | O que o teste prova |
| --- | --- |
| I-5, I-6 | Espelho tem os mesmos grupos, nomes e coordenadas da origem |
| I-7 | Mesmo conjunto de heróis por grupo — nenhum a mais, nenhum a menos |
| I-8 | Herói em dois grupos aparece nos dois, ordenado por posição de cada um |
| I-9 | Herói sem dado vai para o fim do grupo, ordenação estável |
| I-10 | Duas chamadas iguais → mesmo resultado (idempotência) |
| I-17, I-18 | `COMBINED` sem pessoal cai para meta; `PERSONAL_ONLY` sem pessoal dá `null`, nunca cai para meta |
| I-11 | Todo `MetaWinrate` tem `matchCount`. Não existe caminho que produza número sem amostra |
| I-22, I-23, I-24 | Uma fonte fora ⇒ `PARTIAL` e escreve; as duas fora ⇒ `FAILURE`, não escreve, `lastSuccessfulSyncAt` intacto |

**Duas fixtures obrigatórias, e a segunda é a que importa mais:**

1. `hero-grid-real.json` — cópia **anonimizada** do seu grid real, no espírito de `match-parsed.json`.
   Estrutura real (8 grupos, nomes em pt-BR, um herói repetido, coordenadas fracionárias) pega bug que
   objeto sintético de 2 grupos não pega. Renomeie os grupos se não quiser expor seus nomes — e note
   que os nomes em pt-BR abreviados são justamente o motivo pelo qual o recorte por posição saiu do
   escopo (FR-034a).
2. `hero-grid-adverse.json` — a **anti-fixture**, sintética, desenhada para ser o oposto do seu grid:
   3 layouts (dois de nome igual), duas categorias de nome idêntico no mesmo layout, um layout de
   categoria única, uma categoria vazia, poucos heróis por grupo, um herói em três grupos, `version`
   diferente de 3.

Por que a segunda é indispensável: seu grid tem **um layout só**, e a invariante I-2 ("não altere
nenhum outro layout") passa **vazia** contra ele — não há outro layout para não alterar. Sem a
anti-fixture, a garantia mais importante para quem tem vários layouts fica sem teste. Nomes de
categoria repetidos também são caso real: o grid de meta publicado pelo D2PT repete `Best with` sete
vezes num único layout.

---

## Nível 2 — fontes de dados, sem escrever

```bash
# OpenDota: público, sem chave. 127 heróis, buckets 1..8 presentes.
curl -s "https://api.opendota.com/api/heroStats" -H 'User-Agent: GlimpseGG_Dota2_Desktop/1.0' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d), '7_pick' in d[0], '8_win' in d[0])"

# Desempenho pessoal: público, sem token. Troque pelo seu account id.
curl -s "https://api.opendota.com/api/players/86738327/heroes" -H 'User-Agent: GlimpseGG_Dota2_Desktop/1.0' \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d), sorted(d[0].keys())[:6])"
```

**Esperado**: `127 True True` na primeira, e uma lista de heróis com `games`/`win` na segunda.

**STRATZ**: rodar a query de [meta-sources.md](./contracts/meta-sources.md) com o token e salvar a
resposta **anonimizada** como fixture. Confirme aqui o argumento de bracket
(`bracketBasicIds` vs `bracketIds`) — é a única incógnita de contrato que sobrou. **Nunca** cole o
token em log, fixture ou issue: ele não é revogável.

**O D2PT não entra em nenhuma validação** — foi cortado do escopo (FR-013a).

---

## Nível 3 — app rodando, ainda sem escrever

```bash
npm run electron:dev
```

Roteiro:

1. Configurações → a opção da feature está **desmarcada**. Feche o app. Confirme, no log de rede e no
   sha256 do grid, que **nada** foi lido nem requisitado (FR-002, SC-001).
2. Marque a opção. O app pede confirmação explícita, dizendo que vai *acrescentar* um layout e que a
   origem não será alterada (FR-003).
3. A conta Steam já vem pré-selecionada (seu `steamAccountId` bate com o `id3` do `userdata/`). Só
   uma conta na lista, mesmo com `.steam/steam`, `.steam/root` e `.local/share/Steam` existindo —
   se aparecerem três, o dedupe por `realpath` está quebrado (R2).
4. Escolha o layout de origem (`Layout1`). Não há mapeamento de posição a fazer — a ordenação usa o
   winrate geral do herói (FR-034), e a tela precisa dizer isso para você não ler a ordem do grupo de
   suportes como "melhores suportes" (FR-034b).
5. A aba mostra o ranking: winrate, fonte, amostra e as duas parcelas da nota combinada. Nenhum
   número sem procedência (SC-005, SC-005a).
6. Limpe o token da STRATZ e recarregue. A feature continua funcionando com a OpenDota, e a tela diz
   que a STRATZ não foi usada (FR-015a).

**Modo browser**: `npm run dev` → o ranking aparece (as duas fontes funcionam por fetch direto), e a
escrita de layout aparece como indisponível, explicitamente. Sucesso simulado aqui é bug.

---

## Nível 4 — a escrita (com Dota fechado)

Sempre com o backup manual feito.

```bash
# antes
sha256sum "$GRID"; python3 -c "
import json;d=json.load(open('$GRID'));print([c['config_name'] for c in d['configs']])"
```

Sincronize pelo app. Depois:

```bash
python3 - <<'PY'
import json, os, glob
GRID = os.path.expanduser('~/.steam/steam/userdata/86738327/570/remote/cfg/hero_grid_config.json')
BK   = sorted(glob.glob(GRID.replace('.json','') + '*glimpse.bak*'))
new  = json.load(open(GRID))
old  = json.load(open(BK[-1]))
src_name = 'Layout1'
o = [c for c in old['configs'] if c['config_name'] == src_name][0]
n = [c for c in new['configs'] if c['config_name'] == src_name][0]
print('origem intacta (deep-equal):', o == n)                       # SC-003
mir = [c for c in new['configs'] if c['config_name'] != src_name and 'Glimpse' in c['config_name']]
print('espelhos encontrados:', len(mir))                            # SC-003b -> 1
m = mir[0]
print('mesmo nº de grupos:', len(m['categories']) == len(o['categories']))          # I-5
print('nomes/coords iguais:', all(
    a['category_name']==b['category_name'] and a['x_position']==b['x_position']
    and a['y_position']==b['y_position'] and a['width']==b['width'] and a['height']==b['height']
    for a,b in zip(m['categories'], o['categories'])))                              # I-6
print('mesmo conjunto por grupo:', all(
    sorted(a['hero_ids'])==sorted(b['hero_ids'])
    for a,b in zip(m['categories'], o['categories'])))                              # I-7
print('ordem mudou em algum grupo:', any(
    a['hero_ids']!=b['hero_ids'] for a,b in zip(m['categories'], o['categories'])))
print('version preservado:', new['version'] == old['version'])                      # I-3
PY
```

**Esperado**: `True`, `1`, `True`, `True`, `True`, `True`, `True`.

Depois abra o Dota 2: dois layouts na tela de heróis, `Layout1` do jeito que você deixou e o espelho
ordenado.

### Idempotência (FR-008c, SC-003b)

Sincronize 3 vezes seguidas. A cada vez, o número de configs no arquivo tem de ser **o mesmo**. Se
crescer, `mirrorConfigName` não está sendo reusado.

### Re-espelhar (FR-008d, US1 cenário 6)

No Dota, renomeie um grupo do `Layout1` ou mova um herói de grupo. Feche o Dota. Sincronize. O
espelho passa a refletir a nova estrutura, e a tela sinaliza que a estrutura mudou.

### Identidade sobrevive a rename (FR-008h)

O teste que mais gente vai encontrar sem querer:

1. No Dota, **renomeie o layout espelho** (ou o `Layout1`). Feche o Dota.
2. Sincronize.
3. **Esperado**: o app reconhece o mesmo layout pela posição, atualiza o rótulo e **não** cria um
   segundo espelho. Se aparecer um espelho novo, a identidade está por nome e FR-008c foi violada.

### Vários layouts e nomes repetidos (FR-008i, I-2)

1. Crie no Dota um segundo e um terceiro layout, **dois deles com o mesmo nome**.
2. Dentro do layout de origem, crie **dois grupos com o mesmo nome**.
3. Sincronize e confirme: os outros layouts intactos, os dois grupos de nome igual espelhados e
   ordenados **independentemente**, e a escolha da origem sem ambiguidade na tela.

---

## Nível 5 — os caminhos ruins

Estes são os cenários que justificam a feature existir do jeito que ela existe.

| Cenário | Como forçar | Esperado |
| --- | --- | --- |
| Dota 2 aberto | Abra o Dota, sincronize | Aviso de que a mudança pode ser descartada ao sair, com opção de adiar. Sem confirmação, não escreve (FR-011) |
| Todas as fontes fora | Corte a rede | `outcome: FAILURE`, arquivo **não** escrito, sha256 inalterado, `lastSuccessfulSyncAt` inalterado (FR-017, SC-006) |
| Uma fonte fora | Bloqueie `api.opendota.com` ou `api.stratz.com`, não os dois | `outcome: PARTIAL`, sincronização conclui e escreve, aviso de qual fonte faltou (FR-016) |
| Sem token STRATZ | Limpe o token | Roda inteira com OpenDota, rotulado. **Não** é erro (FR-015a) |
| JSON inválido | Ponha um `{` extra numa **cópia** e aponte o caminho manual para ela | Aborta, avisa, não sobrescreve (L-2) |
| Sem permissão | `chmod 444` no diretório de uma cópia | Falha explícita, original intacto (E-8) |
| Colisão de nome | Crie no Dota um layout com o nome do espelho | Não sobrescreve; pede outro nome (FR-008e) |
| Origem apagada | Remova `Layout1` no Dota | Avisa, mantém o espelho antigo, pede nova origem |
| Guarda de imutabilidade | Em teste, injete uma mutação no config de origem antes de gravar | Aborta com `SOURCE_MUTATED`, **não** grava (E-3). Este é o teste mais importante da feature |
| Arquivo ausente | Aponte para um caminho sem o arquivo | Estado "crie um grid no Dota primeiro", sem criar arquivo (R3) |
| Falso positivo de processo | Rode um comando cuja linha contenha `dota2` | `isDotaRunning` devolve `false`. Casar linha de comando em vez de nome de executável foi o erro real encontrado na pesquisa (R12) |

---

## Nível 6 — agendamento

Não espere 24h. O agendador é função pura:

```bash
npx vitest run src/utils/heroGrid/syncScheduler.test.ts
```

Casos obrigatórios: 23h59 → não devido; 24h01 → devido; app reaberto depois de 3 dias fechado → devido
**uma vez** (FR-023); relógio recuado (`now < lastAt`) → não devido e marcador **não** reescrito
(FR-029); backoff crescente com teto de 6h; sucesso zera falhas.

Fim a fim, com o app aberto: adultere `heroGridLastSuccessfulSyncAt` no `stratz_app_config.json` para
25h atrás, reabra o app, e uma sincronização deve disparar sozinha.

### Restaurar

```bash
# do backup do app
ls -la "$(dirname "$GRID")"/*glimpse.bak*
# ou do seu backup manual
cp -v "$HOME/hero_grid_config.json.MANUAL-BACKUP-"* "$GRID"
sha256sum "$GRID"   # tem de bater com o sha256 anotado no início
```

---

## Critério de pronto

- [ ] `npm test`, `npx oxlint` e `npm run build` verdes
- [ ] Todas as invariantes de [data-model.md](./data-model.md) com teste nomeado
- [ ] Nível 4 devolvendo `True` em todas as linhas, com Dota fechado e depois aberto
- [ ] 3 sincronizações seguidas sem multiplicar configs
- [ ] Todos os cenários do Nível 5 com o comportamento esperado
- [ ] sha256 do grid original recuperável a partir do backup, byte a byte
- [ ] Nenhum número na tela sem fonte e amostra
- [ ] Feature desmarcada em instalação nova e em atualização, com zero requisição
- [ ] Sincronização completa **sem** token da STRATZ, do começo ao fim
- [ ] Nenhuma requisição a `dota2protracker.com` em nenhum cenário
- [ ] Validado com **mais de um layout** na coleção, incluindo dois de nome igual
- [ ] Validado com **dois grupos de nome igual** dentro do layout de origem
- [ ] Renomear o espelho no jogo não produz um segundo espelho
