# src/components/brand/

A marca dentro do app. Não confundir com `build/`, que é a arte dos ícones do executável.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `BrandMark.tsx` | Monograma "G" em SVG, **redesenhado à mão na grade de 24px** |
| `BrandLockup.tsx` | Wordmark GLIMPSE + GG |

Ambos são usados pela `Navbar` e pelo splash do `App.tsx`; o `BrandMark` aparece também no
`auth/OnboardingModal.tsx`.

## Regras locais

- `BrandMark.tsx` e `build/icon.svg` são **arquivos diferentes com a mesma identidade visual**:
  o master de `build/` gera os PNG/ICO por script, o daqui é desenho manual para tamanho pequeno.
  Mexer em um exige revisar o outro.

## Ao sair um patch

Nada aqui muda por patch de Dota.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [build/CLAUDE.md](../../../build/CLAUDE.md)
