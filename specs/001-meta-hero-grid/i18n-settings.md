# Manifesto i18n — bloco de configurações da feature (T033, T034, T038, T063)

Chaves usadas por `src/components/settings/SettingsModal.tsx`. **66 chaves**, todas com prefixo
`heroGrid`.

Este arquivo existe porque `src/i18n/translations.ts` está sendo consolidado por outro agente: duas
escritas simultâneas no mesmo arquivo perdem uma. Quem for mesclar copia as duas colunas para os
**dois** dicionários (`pt-BR` e `en-US`) — o gate `_localeParity` e o `translations.test.ts`
(paridade, nenhuma entrada vazia, mesmos placeholders, nenhuma chave órfã) valem normalmente. Até a
mesclagem, `tsc -b` acusa "chave inexistente" em cada `t(...)` deste bloco; é esperado.

## Placeholders

Os `{nome}` são **idênticos** nas duas colunas — é gate de teste. As chaves que têm placeholder:

| Chave | Placeholders |
| --- | --- |
| `heroGridAccountOptionWithGrid` | `{id}` |
| `heroGridAccountOptionWithoutGrid` | `{id}` |
| `heroGridLayoutOption` | `{name}`, `{position}`, `{groups}` |
| `heroGridLayoutOptionUnnamed` | `{position}`, `{groups}` |
| `heroGridConfirmAppend` | `{mirror}` |
| `heroGridConfirmSourceUntouched` | `{source}` |
| `heroGridReadyLabel` | `{name}`, `{position}` |
| `heroGridMirrorStillThere` | `{name}`, `{position}` |
| `heroGridBackupsFound` | `{count}`, `{date}` |

`{position}` é **1-based**, só para leitura humana. A identidade persistida continua sendo o `index`
cru do array `configs` (N-1) — a conversão acontece no JSX, nunca na preferência.

## Bloco e ativação (FR-001, FR-002)

| chave | pt-BR | en-US |
| --- | --- | --- |
| `heroGridSetting` | Layout espelho de heróis | Hero mirror layout |
| `heroGridDesc` | Cria na sua coleção do Dota um layout novo com os mesmos grupos do seu layout, só reordenado pelo winrate do patch. O layout de origem não é alterado. | Adds a new layout to your Dota collection with the same groups as yours, only reordered by the patch win rate. Your source layout is never changed. |
| `heroGridEnableLabel` | Ativar | Enable |
| `heroGridDisabledHint` | Desmarcada: o app não lê nem escreve a sua coleção de layouts e não consulta as fontes de meta. | Unchecked: the app does not read or write your layout collection, and makes no meta-source requests. |
| `heroGridBrowserModeNotice` | Neste modo (navegador) o app não escreve layout nenhum: o acesso ao arquivo do Dota existe só no app instalado. Nada aqui é simulado. | In this (browser) mode the app writes no layout at all: access to the Dota file exists only in the installed app. Nothing here is simulated. |
| `heroGridLoading` | Lendo a coleção de layouts… | Reading the layout collection… |

## Conta Steam (FR-005, I-27)

| chave | pt-BR | en-US |
| --- | --- | --- |
| `heroGridAccountLabel` | Conta Steam | Steam account |
| `heroGridAccountDesc` | A conta da máquina que guarda a coleção de layouts. Vem pré-selecionada a que casa com o perfil já configurado no app. | The account on this machine that holds the layout collection. The one matching the profile already configured in the app comes pre-selected. |
| `heroGridAccountNone` | Nenhuma conta Steam com Dota 2 encontrada nesta máquina. Informe o caminho manualmente abaixo. | No Steam account with Dota 2 found on this machine. Enter the path manually below. |
| `heroGridAccountOptionWithGrid` | Conta {id} — coleção encontrada | Account {id} — collection found |
| `heroGridAccountOptionWithoutGrid` | Conta {id} — sem coleção ainda | Account {id} — no collection yet |
| `heroGridAccountConfigured` | perfil do app | app profile |
| `heroGridNoFileHint` | Esta conta ainda não tem coleção de layouts. Crie um grid no Dota 2 primeiro — o app não cria o arquivo. | This account has no layout collection yet. Create a grid in Dota 2 first — the app does not create the file. |

## Caminho manual (FR-006, T034)

| chave | pt-BR | en-US |
| --- | --- | --- |
| `heroGridManualPathLabel` | Caminho do arquivo (manual) | File path (manual) |
| `heroGridManualPathDesc` | Use quando a detecção automática não achar nada: Steam em disco secundário, Flatpak ou Snap fora das raízes conhecidas. Preenchido, ele vence a detecção. | Use it when auto-detection finds nothing: Steam on a second drive, Flatpak or Snap outside the known roots. When filled in, it wins over detection. |
| `heroGridManualPathPlaceholder` | …/userdata/&lt;id&gt;/570/remote/cfg/hero_grid_config.json | …/userdata/&lt;id&gt;/570/remote/cfg/hero_grid_config.json |
| `heroGridManualPathFormatWarning` | O caminho precisa terminar em hero_grid_config.json. | The path must end in hero_grid_config.json. |

## Layout de origem (FR-005a, N-1 a N-4)

| chave | pt-BR | en-US |
| --- | --- | --- |
| `heroGridSourceLabel` | Layout de origem | Source layout |
| `heroGridSourceDesc` | O espelho é um layout novo, acrescentado ao lado deste. A origem não é alterada: nem ordem, nem nomes, nem grupos, nem composição. | The mirror is a new layout, appended alongside this one. The source is never changed: not order, names, groups, nor composition. |
| `heroGridSourcePlaceholder` | Escolha o layout de origem | Choose the source layout |
| `heroGridLayoutOption` | {name} — posição {position}, {groups} grupos | {name} — position {position}, {groups} groups |
| `heroGridLayoutOptionUnnamed` | Sem nome — posição {position}, {groups} grupos | Unnamed — position {position}, {groups} groups |
| `heroGridDuplicateNameHint` | Há layouts com o mesmo nome nesta coleção. É a posição na lista que os distingue, não o nome. | There are layouts with the same name in this collection. Position in the list is what tells them apart, not the name. |
| `heroGridSourceGoneWarning` | O layout de origem configurado não existe mais nessa posição. Escolha outro — o app não procura layout por nome. | The configured source layout no longer exists at that position. Pick another one — the app never looks up a layout by name. |
| `heroGridNoLayouts` | Nenhum layout nesta coleção. | No layouts in this collection. |

## Nome do espelho (N-5)

| chave | pt-BR | en-US |
| --- | --- | --- |
| `heroGridMirrorNameLabel` | Nome do layout espelho | Mirror layout name |
| `heroGridMirrorNameDesc` | Só rótulo: renomear não muda comportamento nenhum. O padrão é o nome da origem seguido de "— GlimpseGG". | Label only: renaming changes no behaviour. The default is the source name followed by "— GlimpseGG". |

## Confirmação antes da primeira escrita (FR-003)

| chave | pt-BR | en-US |
| --- | --- | --- |
| `heroGridEnableWriteButton` | Confirmar e ativar a sincronização | Confirm and enable syncing |
| `heroGridConfirmTitle` | Antes da primeira gravação | Before the first write |
| `heroGridConfirmAppend` | O app vai ACRESCENTAR um layout novo, chamado "{mirror}", à conta escolhida. | The app will ADD a new layout, named "{mirror}", to the chosen account. |
| `heroGridConfirmSourceUntouched` | O layout de origem "{source}" NÃO será alterado: nem ordem, nem nomes, nem grupos, nem composição. | The source layout "{source}" will NOT be changed: not order, names, groups, nor composition. |
| `heroGridConfirmBackup` | Antes de qualquer gravação o app guarda um backup byte a byte do arquivo original. | Before any write the app keeps a byte-for-byte backup of the original file. |
| `heroGridConfirmAccept` | Entendi, ativar | Got it, enable |
| `heroGridConfirmDecline` | Agora não | Not now |
| `heroGridConfirmedNotice` | Sincronização ativada. O espelho é gravado como layout novo, ao lado da origem. | Syncing enabled. The mirror is written as a new layout, alongside the source. |
| `heroGridReadyLabel` | Origem confirmada: {name} (posição {position}). | Source confirmed: {name} (position {position}). |

## Desativação (FR-004, C-4)

| chave | pt-BR | en-US |
| --- | --- | --- |
| `heroGridDisabledTitle` | Sincronização interrompida | Syncing stopped |
| `heroGridDisabledBody` | A opção está desmarcada: o app não lê mais a sua coleção de layouts, não escreve nela e não consulta as fontes de meta. | The option is unchecked: the app no longer reads your layout collection, writes to it, or queries the meta sources. |
| `heroGridSourceUntouched` | O seu layout de origem nunca foi tocado — nem ordem, nem nomes, nem grupos, nem composição. | Your source layout was never touched — not order, names, groups, nor composition. |
| `heroGridMirrorStillThere` | O layout espelho "{name}" continua na sua coleção, na posição {position}. | The mirror layout "{name}" is still in your collection, at position {position}. |
| `heroGridNoMirrorYet` | Nenhum layout espelho foi criado ainda, então não há o que remover. | No mirror layout was created yet, so there is nothing to remove. |
| `heroGridRemoveMirror` | Remover o layout espelho | Remove the mirror layout |
| `heroGridRemoveMirrorUnavailable` | A remoção do espelho é uma gravação e acontece pela aba da feature. | Removing the mirror is a write, and it happens from the feature tab. |
| `heroGridMirrorRemoved` | Layout espelho removido da coleção. | Mirror layout removed from the collection. |
| `heroGridBackupsCheck` | Ver backups disponíveis | Check available backups |
| `heroGridBackupsNone` | Nenhum backup encontrado para esta coleção. | No backup found for this collection. |
| `heroGridBackupsFound` | {count} backup(s) disponível(is). O mais recente é de {date}. | {count} backup(s) available. The most recent is from {date}. |
| `heroGridRestoreLatest` | Restaurar o backup mais recente | Restore the most recent backup |
| `heroGridRestoreDone` | Coleção restaurada a partir do backup mais recente. | Collection restored from the most recent backup. |

## Critério de ordenação (FR-030, FR-031, T063)

| chave | pt-BR | en-US |
| --- | --- | --- |
| `heroGridCriterionLabel` | Critério de ordenação | Ranking criterion |
| `heroGridCriterionCombined` | Combinado | Combined |
| `heroGridCriterionMetaOnly` | Só meta | Meta only |
| `heroGridCriterionPersonalOnly` | Só pessoal | Personal only |
| `heroGridCriterionCombinedDesc` | Padrão: o winrate do meta do patch como base, ajustado pelo seu desempenho. Amostra pessoal pequena pesa pouco. | Default: the patch meta win rate as the base, adjusted by your own results. A small personal sample carries little weight. |
| `heroGridCriterionMetaOnlyDesc` | Só o winrate do meta do patch no ranque de referência. Seu histórico não entra na conta. | Only the patch meta win rate at the reference bracket. Your history is not part of the score. |
| `heroGridCriterionPersonalOnlyDesc` | Só o seu histórico. Herói que você nunca jogou fica marcado como "sem dado", nunca substituído pelo número do meta. | Only your own history. A hero you never played is marked "no data", never silently replaced by the meta number. |

## Ranque de referência (FR-033, FR-020, I-13)

| chave | pt-BR | en-US |
| --- | --- | --- |
| `heroGridBracketLabel` | Ranque de referência | Reference bracket |
| `heroGridBracketDesc` | O recorte de ranque usado no winrate do meta. | The bracket slice used for the meta win rate. |
| `heroGridBracketAuto` | Derivar do meu perfil | Derive from my profile |
| `heroGridBracketUncalibrated` | Não calibrado | Uncalibrated |
| `heroGridBracketHeraldGuardian` | Arauto / Guardião | Herald / Guardian |
| `heroGridBracketCrusaderArchon` | Cruzado / Arconte | Crusader / Archon |
| `heroGridBracketLegendAncient` | Lenda / Ancião | Legend / Ancient |
| `heroGridBracketDivineImmortal` | Divino / Imortal | Divine / Immortal |
| `heroGridBracketAll` | Todos os ranques (média geral) | All brackets (overall average) |
| `heroGridBracketFallbackNote` | Quando a fonte não segmenta o ranque pedido, o app usa a média geral e a rotula como média geral — nunca como "no seu ranque". | When the source does not slice the requested bracket, the app uses the overall average and labels it as the overall average — never as "at your bracket". |
