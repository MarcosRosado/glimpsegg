# Manifesto i18n — `HeroGridTab.tsx` (T035, T047, T058, T064)

Chaves usadas por `src/components/heroGrid/HeroGridTab.tsx`, para consolidação em
`src/i18n/translations.ts` (**os dois** dicionários). O componente já chama `t()` com estas
chaves, então `tsc -b` fica vermelho até a consolidação — isso é esperado.

Regras que a consolidação precisa preservar:

- os placeholders `{...}` são **idênticos** nas duas colunas (é gate de teste em
  `i18n/translations.test.ts`);
- nenhuma entrada vazia;
- as tabelas enum→texto (`MetaSource`, `RankingCriterion`, `NoDataReason`, `SyncOutcome`,
  `SyncPhase`, `HeroGridBlocker`) são `Record<..., TranslationKey>` com literais no
  componente — nenhuma chave é montada em runtime.

## Chaves já existentes, reaproveitadas (NÃO recriar)

| chave | por quê |
| --- | --- |
| `coachBracketYours` | "no seu ranque" / "at your bracket" — mesma afirmação de honestidade de `useBuildAdvice`; duas traduções dela divergiriam com o tempo (I-13 / FR-020) |
| `coachBracketGeneric` | "média geral" / "all brackets" — o rótulo quando `bracketIsPlayerSpecific === false` |
| `coachSampleSize` | `n={n}` — a amostra exibida no chip de procedência (FR-014) |

## Chaves novas (101)

| chave | pt-BR | en-US | observação |
| --- | --- | --- | --- |
| `heroGridTabTitle` | Layout espelho de heróis | Hero mirror layout |  |
| `heroGridTabSubtitle` | Ranking de meta aplicado à ordem dos grupos do seu layout | Meta ranking applied to the group order of your layout |  |
| `heroGridCriterionLabel` | Critério ativo | Active criterion | T064 (FR-030). Pode duplicar com i18n-settings.md |
| `heroGridCriterionCombined` | Combinado (meta + pessoal) | Combined (meta + personal) | Tabela RankingCriterion. Pode duplicar com i18n-settings.md |
| `heroGridCriterionMetaOnly` | Só meta geral | Overall meta only | Tabela RankingCriterion. Pode duplicar com i18n-settings.md |
| `heroGridCriterionPersonalOnly` | Só desempenho pessoal | Personal performance only | Tabela RankingCriterion. Pode duplicar com i18n-settings.md |
| `heroGridBracketLabel` | Winrate de meta: {bracket} | Meta winrate: {bracket} | {bracket} recebe coachBracketYours ou coachBracketGeneric já traduzido |
| `heroGridSourceLayout` | Origem | Source |  |
| `heroGridMirrorLayout` | Espelho | Mirror |  |
| `heroGridSourceNone` | Nenhum layout de origem escolhido | No source layout chosen |  |
| `heroGridMirrorNone` | Nenhum espelho criado ainda | No mirror created yet |  |
| `heroGridLayoutPosition` | posição {index} | position {index} | Identidade é a POSIÇÃO, nunca o nome |
| `heroGridSyncNow` | Sincronizar agora | Sync now |  |
| `heroGridSyncing` | Sincronizando… | Syncing… |  |
| `heroGridRemoveMirror` | Remover espelho | Remove mirror | FR-008g |
| `heroGridRestoreBackup` | Restaurar backup | Restore backup | FR-009 |
| `heroGridBackupsCount` | {n} cópias de segurança | {n} backups |  |
| `heroGridNoBackups` | Nenhuma cópia de segurança | No backups yet |  |
| `heroGridFreshnessTitle` | Frescor da sincronização | Sync freshness | FR-024a / FR-026 |
| `heroGridLastSuccess` | Última bem-sucedida | Last successful |  |
| `heroGridLastAttempt` | Última tentativa | Last attempt |  |
| `heroGridLastOutcome` | Resultado | Outcome |  |
| `heroGridNextDue` | Próxima prevista | Next due |  |
| `heroGridNextDueUnknown` | Sem previsão | Not scheduled | nextDueAt nulo: feature desativada ou sem tentativa |
| `heroGridDaysSinceLabel` | Desde a última | Since the last one |  |
| `heroGridNeverSynced` | Nunca sincronizado | Never synced | NÃO é zero dias — zero dia leria como sincronizado hoje |
| `heroGridDaysSinceToday` | menos de 1 dia | less than 1 day | daysSinceLastSuccess vem em fração de dia |
| `heroGridDaysSinceOne` | 1 dia | 1 day | Chave separada por causa do plural; sem placeholder nas duas locales |
| `heroGridDaysSinceMany` | {n} dias | {n} days |  |
| `heroGridStaleTitle` | O espelho está velho | The mirror is stale | FR-024a: 2 dias inteiros ou mais |
| `heroGridStaleBody` | Passaram {days} desde a última sincronização bem-sucedida. Com o app fechado não há sincronização, então o espelho pode estar refletindo um patch anterior. | {days} have passed since the last successful sync. There is no sync while the app is closed, so the mirror may be reflecting an earlier patch. | {days} recebe o texto de heroGridDaysSince* |
| `heroGridStaleNeverBody` | Nenhuma sincronização bem-sucedida até agora. O espelho ainda não existe ou não reflete nenhum ranking. | No successful sync so far. The mirror does not exist yet or reflects no ranking at all. |  |
| `heroGridPhaseIdle` | Em dia | Up to date | Tabela SyncPhase |
| `heroGridPhaseDue` | Devido agora | Due now | Tabela SyncPhase |
| `heroGridPhaseRunning` | Sincronizando | Syncing | Tabela SyncPhase |
| `heroGridPhaseBackoff` | Aguardando nova tentativa | Waiting to retry | Tabela SyncPhase; espera crescente de FR-028 |
| `heroGridPhaseOff` | Desativado | Disabled | Tabela SyncPhase |
| `heroGridOutcomeSuccess` | Sucesso | Success | Tabela SyncOutcome |
| `heroGridOutcomePartial` | Parcial | Partial | Tabela SyncOutcome; escreveu com uma fonte só |
| `heroGridOutcomeFailure` | Falha | Failure | Tabela SyncOutcome; nada foi escrito |
| `heroGridHistoryTitle` | Histórico de sincronizações | Sync history |  |
| `heroGridHistoryEmpty` | Nenhuma sincronização registrada ainda. | No sync recorded yet. |  |
| `heroGridHistoryLimit` | Os 20 registros mais recentes, do mais novo para o mais antigo. | The 20 most recent records, newest first. | C-5 |
| `heroGridHistorySources` | Fontes | Sources |  |
| `heroGridHistoryFailed` | Faltaram | Missing |  |
| `heroGridHistoryHeroes` | {n} heróis ordenados | {n} heroes ordered |  |
| `heroGridHistoryStructureChanged` | estrutura mudou | structure changed |  |
| `heroGridSourceOpenDota` | OpenDota | OpenDota | Tabela MetaSource; nome próprio, igual nas duas locales |
| `heroGridSourceStratz` | STRATZ | STRATZ | Tabela MetaSource; nome próprio, igual nas duas locales |
| `heroGridSourcesUsed` | Fontes usadas: {sources} | Sources used: {sources} | FR-015 |
| `heroGridSourcesMissingTitle` | Fonte de winrate indisponível | Winrate source unavailable | FR-016 |
| `heroGridSourcesMissingBody` | Faltou nesta sincronização: {sources}. O ranking foi concluído com as fontes restantes, e a ausência de token da STRATZ conta como fonte indisponível, não como erro. | Missing in this sync: {sources}. The ranking was completed with the remaining sources, and a missing STRATZ token counts as an unavailable source, not an error. | FR-016 / FR-015a |
| `heroGridRankingTitle` | Ranking do layout de origem | Source layout ranking |  |
| `heroGridRankingSubtitle` | A mesma nota vale em todos os grupos: cada grupo do espelho é reordenado por esta lista, restrita aos heróis que ele contém. | The same score applies to every group: each mirror group is reordered by this list, restricted to the heroes it contains. | FR-034a |
| `heroGridRankingCount` | {n} heróis | {n} heroes |  |
| `heroGridRankingWithoutData` | {n} sem dado | {n} without data |  |
| `heroGridRankingEmpty` | Nenhum ranking calculado ainda. Sincronize para calcular a partir dos grupos do layout de origem. | No ranking calculated yet. Sync to calculate it from the groups of the source layout. |  |
| `heroGridRankingUnavailableBrowser` | No modo navegador o app não lê o arquivo de layouts, então não há grupos de origem para ranquear e nada é gravado. | In browser mode the app does not read the layout file, so there are no source groups to rank and nothing is written. | BROWSER_MODE: dito explicitamente, nunca simulado |
| `heroGridScoreLabel` | Nota | Score |  |
| `heroGridScoreNotDisplayable` | nota sem decomposição — não exibida | score without breakdown — not shown | FR-030b: nota sem breakdown NÃO é exibível |
| `heroGridMetaWinrate` | Winrate de meta | Meta winrate |  |
| `heroGridPersonalWinrate` | Seu winrate | Your winrate |  |
| `heroGridPersonalGames` | {n} partidas suas | {n} matches of yours | FR-032: amostra pessoal por herói |
| `heroGridPersonalNone` | sem histórico seu com este herói | no personal history with this hero |  |
| `heroGridMetaComponent` | Parcela do meta | Meta component | FR-030b |
| `heroGridPersonalComponent` | Parcela pessoal | Personal component | FR-030b |
| `heroGridPersonalWeight` | Peso pessoal | Personal weight | FR-030b |
| `heroGridPersonalNotApplied` | componente pessoal não aplicado | personal component not applied | FR-030c |
| `heroGridNoData` | Sem dado | No data |  |
| `heroGridNoDataNoMeta` | Nenhuma das fontes tem winrate deste herói. Ele fica no espelho, ordenado após os heróis com dado, e nenhum winrate foi presumido. | No source has a winrate for this hero. It stays in the mirror, ordered after the heroes with data, and no winrate was assumed. | Tabela NoDataReason |
| `heroGridNoDataNoPersonal` | Você não tem partidas com este herói, e o critério ativo é só desempenho pessoal. O número do meta não substitui o seu histórico. | You have no matches with this hero, and the active criterion is personal performance only. The meta number is not a substitute for your history. | Tabela NoDataReason; FR-032a |
| `heroGridNoDataHeroUnknown` | Herói desconhecido no catálogo desta versão do app. | Hero unknown in this app version's catalog. | Tabela NoDataReason |
| `heroGridGeneralWinrateTitle` | O winrate é o geral do herói | The winrate is the hero's overall one |  |
| `heroGridGeneralWinrateBody` | A ordem de um grupo não é um ranking de função. O app não infere a função de um grupo pelo nome, então um grupo de suportes ordenado por esta lista não significa melhores suportes — significa heróis com melhor winrate geral no patch. | A group's order is not a role ranking. The app does not infer a group's role from its name, so a support group ordered by this list does not mean best supports — it means heroes with the best overall winrate in the patch. | FR-034b: obrigatório |
| `heroGridManualEditTitle` | O espelho é gerado | The mirror is generated |  |
| `heroGridManualEditBody` | Qualquer edição manual feita no layout espelho será descartada na próxima sincronização. Edite o layout de origem — ele nunca é alterado pelo app. | Any manual edit made in the mirror layout will be discarded on the next sync. Edit the source layout instead — the app never changes it. | FR-008f |
| `heroGridStructureChangedTitle` | A estrutura da origem mudou | The source structure changed |  |
| `heroGridStructureChangedBody` | O layout de origem mudou de estrutura desde o espelho anterior, e a sincronização mais recente reconstruiu o espelho a partir dela. Se você mexeu nos grupos depois disso, sincronize de novo — até lá o espelho está desatualizado em relação à origem. | The source layout changed structure since the previous mirror, and the most recent sync rebuilt the mirror from it. If you changed the groups after that, sync again — until then the mirror is out of date relative to the source. | FR-035b / FR-008d |
| `heroGridOutsideSourceTitle` | Fora do layout de origem | Outside the source layout |  |
| `heroGridOutsideSourceBody` | {n} heróis do ranking não pertencem a nenhum grupo do layout de origem. Eles aparecem aqui como informação e não são inseridos no espelho. | {n} heroes in the ranking do not belong to any group of the source layout. They are listed here for information and are not inserted into the mirror. | FR-035a / FR-008a |
| `heroGridBlockedTitle` | Não foi possível sincronizar | Could not sync |  |
| `heroGridBlockerDetail` | Detalhe: {detail} | Detail: {detail} | S-2: mensagem, nunca token |
| `heroGridBrowserModeTitle` | Modo navegador | Browser mode |  |
| `heroGridBlockDisabled` | A feature está desativada. Ative nas configurações — enquanto ela estiver desligada, nenhum arquivo é lido e nenhuma requisição sai. | The feature is disabled. Enable it in settings — while it is off, no file is read and no request is made. | Tabela HeroGridBlocker; FR-002 |
| `heroGridBlockBrowserMode` | No modo navegador a gravação do arquivo de layouts não está disponível. Nada foi escrito, e nada será — abra o app em Electron para sincronizar. | In browser mode writing the layout file is not available. Nothing was written, and nothing will be — open the app in Electron to sync. | Tabela HeroGridBlocker |
| `heroGridBlockNoAccount` | Nenhuma conta Steam com arquivo de layouts foi encontrada. Escolha a conta ou informe o caminho do arquivo nas configurações. | No Steam account with a layout file was found. Choose the account or set the file path in settings. | Tabela HeroGridBlocker; FR-005 / FR-006 |
| `heroGridBlockNoSource` | Escolha o layout de origem nas configurações antes de sincronizar. | Choose the source layout in settings before syncing. | Tabela HeroGridBlocker; FR-005a |
| `heroGridBlockFileMissing` | Nenhum arquivo de layouts existe ainda. Crie um grid no Dota primeiro — o app não cria esse arquivo. | No layout file exists yet. Create a grid in Dota first — the app does not create that file. | Tabela HeroGridBlocker; L-1 / I-27 |
| `heroGridBlockInvalidJson` | O arquivo de layouts não é um JSON válido. O app não vai reescrevê-lo: restaure uma cópia de segurança ou conserte o arquivo pelo Dota. | The layout file is not valid JSON. The app will not rewrite it: restore a backup or fix the file through Dota. | Tabela HeroGridBlocker; L-2 |
| `heroGridBlockNoPermission` | Sem permissão para ler ou gravar o arquivo de layouts. Verifique as permissões do diretório da conta Steam. | No permission to read or write the layout file. Check the permissions of the Steam account directory. | Tabela HeroGridBlocker |
| `heroGridBlockSourceIndexGone` | O layout de origem escolhido não existe mais nessa posição. Escolha uma nova origem nas configurações — o app não adivinha por nome, porque o layout de nome igual que sobrou pode ser outro. | The chosen source layout no longer exists at that position. Choose a new source in settings — the app does not guess by name, because the remaining layout with the same name may be a different one. | Tabela HeroGridBlocker; N-4 |
| `heroGridBlockNameCollision` | O nome pretendido para o espelho já pertence a um layout que o app não criou. Escolha outro nome — o layout existente não será sobrescrito. | The intended mirror name already belongs to a layout the app did not create. Choose another name — the existing layout will not be overwritten. | Tabela HeroGridBlocker; FR-008e |
| `heroGridBlockDotaRunning` | O Dota 2 está em execução e reescreve o arquivo de layouts ao sair, então a alteração pode ser descartada. Feche o jogo e sincronize, ou grave agora mesmo assim. | Dota 2 is running and rewrites the layout file on exit, so the change may be discarded. Close the game and sync, or write now anyway. | Tabela HeroGridBlocker; FR-011 |
| `heroGridBlockRateLimited` | A STRATZ recusou a consulta por limite de requisições. O app não repete a chamada; tente mais tarde. | STRATZ refused the query due to rate limiting. The app does not retry the call; try again later. | Tabela HeroGridBlocker |
| `heroGridBlockSourceMutated` | A gravação foi abortada porque o layout de origem seria alterado. Nada foi escrito — o arquivo mudou entre a leitura e a escrita. Sincronize de novo. | The write was aborted because the source layout would have been changed. Nothing was written — the file changed between the read and the write. Sync again. | Tabela HeroGridBlocker; E-3 / I-1 |
| `heroGridBlockAllSourcesDown` | As duas fontes de winrate estão indisponíveis. O arquivo de layouts não foi tocado, e a última sincronização bem-sucedida continua valendo. | Both winrate sources are unavailable. The layout file was not touched, and the last successful sync still stands. | Tabela HeroGridBlocker; FR-017 / I-24 |
| `heroGridBlockWriteFailed` | A gravação falhou. O arquivo original está preservado pela cópia de segurança feita antes da tentativa. | The write failed. The original file is preserved by the backup taken before the attempt. | Tabela HeroGridBlocker; FR-009 / FR-010 |
| `heroGridDotaRunningConfirm` | Gravar mesmo assim | Write anyway | Chama syncNow({ allowWhileDotaRunning: true }) |
| `heroGridDotaRunningPostpone` | Adiar | Postpone | FR-011 |
| `heroGridPostponedTitle` | Sincronização adiada | Sync postponed |  |
| `heroGridPostponedBody` | Nada foi escrito. Feche o Dota 2 e sincronize de novo quando quiser. | Nothing was written. Close Dota 2 and sync again whenever you want. |  |
