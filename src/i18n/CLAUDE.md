# src/i18n/

Os dois dicionários do app. O `t(key, params)` que os consome mora em
`context/LanguageContext.tsx`; aqui só há dado e gates. Os testes que seguram os dicionários moram
em `tests/i18n/translations.test.ts` — como toda a suíte, fora de `src/`.

## Arquivos

| Arquivo | Papel | Consumido por |
| --- | --- | --- |
| `translations.ts` | `pt-BR` e `en-US` num único objeto `as const`. Exporta `translations` e `TranslationKey = keyof typeof translations['pt-BR']`. No fim do arquivo, o gate `_localeParity` | `context/LanguageContext.tsx` → toda a UI via `t()` |

`tests/i18n/translations.test.ts` (rodado por `npm test`) cobre paridade de chaves, nenhuma entrada
vazia, mesmos placeholders nas duas locales e o guard de chave órfã, que continua varrendo `src/`.

## Regras locais

- **Nunca montar chave em runtime** (`t(\`prefixo${x}\`)`). Tabela de chave dinâmica é
  `Record<..., TranslationKey>` com literais explícitos. O guard de órfã só enxerga arquivos
  `.ts`/`.tsx` e **literais** entre aspas, então chave concatenada aparece como órfã e o teste
  fica vermelho — a correção é a tabela explícita, nunca afrouxar o guard.
- **Os dois gates pegam lados opostos.** `TranslationKey` sai de pt-BR, então chave usada que não
  existe não compila; `const _localeParity: Record<TranslationKey, string> = translations['en-US']`
  pega o inverso — chave que existe em pt-BR e falta em en-US, que antes caía em silêncio no
  fallback em runtime. Nenhum dos dois vê placeholder divergente nem valor vazio: isso é o teste.
- **Placeholder é por nome.** `{count}` no pt e `{n}` no en renderiza `{n}` literal na tela. O teste
  compara os conjuntos das duas locales.
- **Texto não mora no motor.** `awardEngine` devolve `AwardId` + número cru; as regras de coaching
  devolvem `RuleId` + `params`. O rótulo entra aqui. Regra nova de coaching toca quatro pontos, e
  **dois deles são os dois dicionários** — faltar um quebra o build ou os testes.
- Entrada vazia é erro, não "traduzo depois": string vazia cai no fallback e mostra o nome da chave.
- Chave que ninguém usa também é erro. Já foram dezenas acumuladas em silêncio, quase sempre porque
  o componente ficou com o texto cravado no JSX enquanto a tradução seguia no dicionário.

## Ao sair um patch

Nada aqui muda por patch de Dota. Nome de herói, item e habilidade vem de `constants/`, não do
dicionário — `i18n` traduz a **interface**, não o conteúdo do jogo. Um patch só chega aqui quando
traz um conceito novo de UI (um modo de fila com tela própria, um selo novo), e aí o trabalho é o
normal: chave nas duas locales.

## Armadilha de dev

Editou `translations.ts` com o vite rodando? **Recarregue a janela** antes de estranhar chave crua
na tela: o HMR não reflete a mudança do dicionário.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../components/CLAUDE.md](../components/CLAUDE.md) ·
[../types/CLAUDE.md](../types/CLAUDE.md) · [../../tests/CLAUDE.md](../../tests/CLAUDE.md) ·
[docs/PATCH-CHECKLIST.md](../../docs/PATCH-CHECKLIST.md)
