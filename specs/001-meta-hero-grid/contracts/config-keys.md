# Contrato: chaves de configuração

Persistência segue os dois caminhos que o projeto já tem: `stratz_app_config.json` no `userData`
(Electron, via `store:get`/`store:set`) e `localStorage` no caminho browser.

## Chaves novas em `AppConfig`

| Chave | Tipo | Default | Requisito |
| --- | --- | --- | --- |
| `heroGridEnabled` | `boolean` | **`false`** | FR-001 |
| `heroGridSteamId3` | `string \| null` | `null` | FR-005 |
| `heroGridFilePath` | `string \| null` | `null` | FR-006 |
| `heroGridSource` | `{ index: number, name: string } \| null` | `null` | FR-005a, FR-008h |
| `heroGridMirror` | `{ index: number, name: string } \| null` | `null` | FR-008b, FR-008h |
| `heroGridMirrorName` | `string \| null` | `null` (cai no default de N-5) | FR-008b |
| `heroGridCriterion` | `'COMBINED' \| 'META_ONLY' \| 'PERSONAL_ONLY'` | **`'COMBINED'`** | FR-030 |
| `heroGridBracket` | `RankBracketBasic \| null` | `null` (derivar do perfil) | FR-033 |
| `heroGridLastSuccessfulSyncAt` | `number \| null` | `null` | FR-026 |
| `heroGridLastAttemptAt` | `number \| null` | `null` | FR-028 |
| `heroGridConsecutiveFailures` | `number` | `0` | FR-028 |
| `heroGridSyncHistory` | `SyncRecord[]` | `[]` | FR-036 |

## Regras

| # | Regra | Requisito |
| --- | --- | --- |
| C-1 | Chave ausente no config lê como o default da tabela. Isso é o que garante "desmarcada em atualização de versão anterior" — quem atualiza não tem a chave, e o default é `false` | FR-001 |
| C-2 | `loadConfig()` no `main.cjs` **não** precisa listar as chaves novas: o default vem do lado `src/`, com a chave ausente. Menos lugar para o default divergir | FR-001 |
| C-3 | `heroGridEnabled === false` ⇒ nenhum código de rede ou de arquivo da feature executa. Verificado por teste do agendador, não só por convenção | FR-002 |
| C-4 | Desmarcar `heroGridEnabled` **preserva** `heroGridMirror`, para a remoção do espelho continuar possível | FR-004 |
| C-8 | `heroGridMirrorName` é o nome **desejado** pelo jogador; `heroGridMirror.name` é o **último nome visto no arquivo**. São chaves distintas de propósito: gravar o nome desejado em `heroGridMirror.name` faria a sincronização seguinte comparar um nome que não existe no disco, concluir **rename** (N-3) e descartar a escolha do jogador | FR-008b, FR-008h |
| C-7 | `index` é a identidade; `name` é atualizado quando o jogador renomeia no jogo (N-3). Nunca o contrário — o app não localiza layout por nome | FR-008h |
| C-5 | `heroGridSyncHistory` guarda no máximo **20** registros; os mais antigos são descartados | FR-036 |
| C-6 | Nenhum valor aqui contém token, nome de arquivo fora do escopo do Steam, ou dado de partida | segredos |

## Chaves i18n

A feature adiciona chaves nos **dois** dicionários de `src/i18n/translations.ts`. O gate
`_localeParity` e o `translations.test.ts` (paridade, sem entrada vazia, mesmos placeholders, sem
chave órfã) valem normalmente.

Grupos de chave previstos: bloco de configurações; aba do ranking; rótulos de procedência
(`OPENDOTA_BRACKET`, `STRATZ_BRACKET`); estados de
sincronização (sucesso/parcial/falha/em andamento/próxima); avisos (Dota rodando, arquivo ausente,
sem permissão, colisão de nome, espelho desatualizado, edição manual será descartada, winrate é o
geral do herói e não o da função do grupo, dias desde a última sincronização); rótulos de
critério; motivos de "sem dado".

**Obrigatório**: as tabelas que mapeiam enum → texto (`MetaSource`, `RankingCriterion`,
`noDataReason`, `outcome`) são `Record<..., TranslationKey>` com **literais explícitos**. Chave
montada em runtime quebra o teste de chave órfã, que só enxerga literais.
