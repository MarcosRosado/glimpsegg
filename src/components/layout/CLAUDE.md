# src/components/layout/

O chrome do app — a moldura que não pertence a nenhuma tela.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `Navbar.tsx` | Topbar: marca, identidade do jogador, busca, configurações, toggle do hero grid | `App.tsx` |
| `StatRail.tsx` | Segunda faixa: forma recente, Glint médio (experimental; some sem partida com nota), KDA, farm e **a versão do patch** (via `useGamePatch`) | `Navbar.tsx` |

## Regras locais

- O `StatRail` exibe o patch (o `SettingsModal` é o outro consumidor de `useGamePatch`). O valor vem
  do hook, nunca de constante — `CURRENT_GAME_PATCH` é só o piso do fallback de
  `services/gameVersionService.ts`.
- A cor do Glint médio vem de `getGlintColor` (`utils/glint.ts`), a mesma dos chips — não há mais corte de cor próprio aqui.

## Ao sair um patch

Nada aqui muda por patch. O número do patch se resolve sozinho em runtime — ver
[`services/CLAUDE.md`](../../services/CLAUDE.md).

Ver também: [../CLAUDE.md](../CLAUDE.md)
