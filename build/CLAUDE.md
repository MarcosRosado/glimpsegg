# build/

Os ícones do app e a configuração de arte do `electron-builder`. Um arquivo é master; todo o
resto é **gerado e commitado**.

## Arquivos

| Item | Origem | Usado por |
| --- | --- | --- |
| `icon.svg` | **Master, editado à mão.** Única fonte de arte | o gerador, e `public/favicon.svg` (cópia) |
| `icons/` | Gerado: `16x16` · `32x32` · `48x48` · `64x64` · `128x128` · `256x256` · `512x512` · `1024x1024` (PNG, alpha, 8-bit) | `linux.icon` e `mac.icon` no `package.json`; `256x256.png` é o ícone da `BrowserWindow` e o único PNG incluído no pacote |
| `icon.png` | Gerado: cópia de `icons/512x512.png` | conveniência / referência |
| `icon.ico` | Gerado: 6 camadas (16 a 256), BMP cru | `win.icon` (NSIS e portable) |
| `icons.manifest.json` | Gerado: sha256 dos masters e de **todas** as saídas, mais a lista de tamanhos | `npm run icons:check` |

`build/icon-small.svg` é um master **opcional** para os tamanhos ≤ 48; hoje não existe, e o
gerador simplesmente usa o master principal. Se aparecer, ele entra no manifesto sozinho.

## Regras locais

- **O CI não gera ícones — ele só cobra.** `npm run icons:check` é o primeiro gate de
  `.github/workflows/release.yml`. Commit que muda `icon.svg` sem os binários regenerados
  publicaria release com arte antiga e nenhum sinal de erro; o gate transforma isso em
  vermelho. Sempre: `npm run icons:generate` e commitar tudo junto.
- **`.ico` com camadas BMP cru é escolha, não descuido.** A variante PNG-in-ICO é bem menor,
  mas o NSIS engasga com ela — instalador sem ícone é pior que 370 KB.
- Duas restrições do gerador caem sobre este diretório: nada de `<text>` no master (a fonte que
  o fontconfig resolve varia por máquina — converta para `<path>`) e ImageMagick precisa do
  delegate **RSVG**, senão gradientes e filtros somem sem erro.
- **Este master não é o monograma in-app.** `src/components/brand/BrandMark.tsx` é outro
  desenho, feito à mão na grade de 24px. Mexer em um exige revisar o outro.
- O `directories.output` do `electron-builder` é `release/`, não este diretório: nada de
  binário de distribuição aqui.

## Ao sair um patch

Nada aqui muda por patch de Dota. São arte e identidade do GlimpseGG — nenhum arquivo deste
diretório contém dado do jogo. Só mexe quem for redesenhar a marca.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../scripts/CLAUDE.md](../scripts/CLAUDE.md) ·
[../public/CLAUDE.md](../public/CLAUDE.md) ·
[src/components/brand/CLAUDE.md](../src/components/brand/CLAUDE.md)
