# src/hooks/

Os dois hooks com estado assíncrono do app. Nenhum deles é testado (o vitest roda com
`environment: 'node'`, sem DOM) — a lógica verificável vive nos módulos puros que eles chamam.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `useGamePatch.ts` | Envolve `gameVersionService`: devolve `{ patch, isLoading, isDynamic, refreshPatch }`, assina `subscribeToPatchUpdates` e dispara um refresh silencioso na montagem | `layout/Navbar.tsx`, `settings/SettingsModal.tsx` |
| `useHeroGridSync.ts` | Orquestra a sincronização inteira do layout espelho: preferências, agendamento, as duas buscas de winrate (meta da OpenDota e histórico pessoal), construção do espelho e escrita pela ponte. Expõe `UseHeroGridSyncResult` (fases, `blocker`, `scores`, `groups`, `mirrorSnapshot`, `syncNow`, `removeMirrorNow`, `restoreLatestBackup`…) | `App.tsx` (cria) → prop `sync` de `heroGrid/HeroGridTab.tsx` e `heroGrid/HeroGridMirrorScreen.tsx`; o `settings/SettingsModal.tsx` só recebe callbacks presos a ela |

## Regras locais

- **`useBuildAdvice` não existe mais.** Buscava `itemFullPurchase`/`heroVsHeroMatchup` na STRATZ;
  foi removido em 2026-11-19 e a recomendação de build está **escondida** no `CoachingInsightsTab`
  (não "sem dados"). `utils/buildAdvisor.ts` segue no repositório, puro e testado. Se voltar (Fase
  5 de [docs/PLANO-OPENDOTA.md](../../docs/PLANO-OPENDOTA.md)), o hook continua sendo chamado só
  pela aba de coaching, nunca no `handleSelectMatch` — senão todas as abas pagam o request.
- **O primeiro parâmetro de `useHeroGridSync` é ignorado.** Era o token da STRATZ; fica na
  assinatura enquanto o `App.tsx` chamar por posição (tirar deslocaria o token para
  `steamAccountId`, e os dois são `string`). `useGamePatch` já não recebe token.
- **`useHeroGridSync` é instância ÚNICA.** O `App.tsx` a cria uma vez e passa o resultado adiante.
  Instanciar de novo em outro componente cria um segundo agendador e uma segunda trava de escrita
  sobre o **mesmo arquivo do jogador** — que é trabalho manual e sem cópia em lugar nenhum.
- `groups`/`scores` são o que foi **construído** nesta sessão; `mirrorSnapshot` é o que foi
  **gravado**. Quando divergem, a tela mostra o snapshot — apresentar o construído seria mostrar
  como layout do jogador algo que o Dota não vai exibir.
- Escrita recusada não apaga o ranking: `groups` é preenchido **antes** da escrita, justamente para
  sobreviver a uma recusa.
- `blocker`/`blockerDetail` existem para a UI explicar o motivo em vez de mostrar erro genérico.
  Bloqueio novo entra como membro de `HeroGridBlocker`, não como string solta.
- Hook novo que faça rede precisa cobrir os **dois caminhos** — quem cobre é o serviço abaixo dele,
  então o hook chama serviço, nunca `fetch` direto.

## Ao sair um patch

- `useGamePatch` é o **consumidor** da virada de patch: `subscribeToPatchUpdates` empurra o valor
  novo e o `Navbar` passa a exibi-lo sem recarregar o app. Nada a ajustar aqui.
- `useHeroGridSync` lê a meta através do `statsCache`, que invalida duro
  quando o patch muda — a meta velha cai sozinha, sem passo manual. O que **não** invalida por patch
  é o cache pessoal de 1h do `personalWinrates.ts`, e isso é deliberado.
- Herói novo chega pelas fontes de meta sem tocar em hook nenhum; o que falta até
  `constants/heroes.ts` ser atualizado é só o nome.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../services/CLAUDE.md](../services/CLAUDE.md) ·
[../services/heroGrid/CLAUDE.md](../services/heroGrid/CLAUDE.md) ·
[../components/heroGrid/CLAUDE.md](../components/heroGrid/CLAUDE.md) ·
[docs/PATCH-CHECKLIST.md](../../docs/PATCH-CHECKLIST.md)
