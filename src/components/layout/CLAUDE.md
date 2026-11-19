# src/components/layout/

O chrome do app — a moldura que não pertence a nenhuma tela.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `Sidebar.tsx` | Barra lateral da 2.0: marca, as seções (`AppSection`) e a entrada do hero grid (só com a feature ligada; desativada com o motivo quando a conta vista é outra). Recolhe em trilho de ícones; a escolha fica em `sidebarCollapsed` (config do Electron) ou `glimpsegg_sidebar_collapsed` (browser), e janela com menos de 1024 px recolhe sozinha sem gravar | `App.tsx` |
| `Navbar.tsx` | Topo: conta (avatar, medalha, MMR com chip de **estimativa**), voltar à conta configurada, **a versão do patch** (via `useGamePatch`), busca, atualizar, configurações | `App.tsx` |

A antiga segunda faixa (`StatRail`) saiu na 2.0: forma, Glint, KDA e GPM foram para o cartão
"Forma" do Início (`dashboard/RecentFormCard.tsx`), e o patch ficou no topo.

## Regras locais

- O `Navbar` exibe o patch (o `SettingsModal` é o outro consumidor de `useGamePatch`). O valor vem
  do hook, nunca de constante — `CURRENT_GAME_PATCH` é só o piso do fallback de
  `services/gameVersionService.ts`.
- **O MMR do topo é estimativa** (tabela fixa por medalha em `constants/ranks.ts`) e sai sempre com
  o `EstimateChip`. Sem o selo, é o número sem procedência que a proposta da 2.0 apontou.
- Estado da barra pode falhar ao ler ou gravar (janela privada, store fora): ela só não lembra.

## Ao sair um patch

Nada aqui muda por patch. O número do patch se resolve sozinho em runtime — ver
[`services/CLAUDE.md`](../../services/CLAUDE.md).

Ver também: [../CLAUDE.md](../CLAUDE.md)
