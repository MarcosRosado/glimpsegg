# Fixtures do `hero_grid_config.json`

Duas fixtures, propositalmente opostas. A real prova que o app lida com o arquivo que o jogador
realmente tem; a adversa prova que a feature não foi escrita só para o grid do autor. Referências
`I-n` são as invariantes de `specs/001-meta-hero-grid/data-model.md`; `L-n`/`E-n` são as regras de
`specs/001-meta-hero-grid/contracts/hero-grid-file.md`.

## `hero-grid-real.json` + `hero-grid-real.raw.txt`

Cópia **anonimizada** do `hero_grid_config.json` real da máquina do autor
(`userdata/<id3>/570/remote/cfg/`). Estrutura, `version`, coordenadas e todos os `hero_ids` são os
originais, byte a byte. A **única** alteração são os oito `category_name`: os nomes reais eram
abreviações em pt-BR de posição (`Hcs Principais`, `Mids principais`, `offs secundários`…), e foram
trocados por `Grupo Um`, `Grupo dois`, `Grupo Três`, `Grupo quatro`, `Grupo Cinco`, `grupo seis`,
`grupo Sete`, `grupo oito`. A troca preserva o que importa para os testes: pt-BR, abreviado, com
acento e com capitalização **inconsistente** — é exatamente essa irregularidade que motivou o corte
do recorte por posição (FR-034a: o app não infere a função de um grupo pelo nome dele).

| O que contém | Invariante que exercita |
| --- | --- |
| 1 layout (`Layout1`), 8 categorias | I-5, I-6 — espelho tem o mesmo número de grupos e os mesmos rótulos/geometria |
| coordenadas fracionárias de 6 decimais (`43.478260`, `284.347839`) | FR-007c / D-2 — o serializador precisa reproduzir o estilo da Valve |
| `version: 3` | I-3 — `version` é lido, não fixado |
| 128 entradas de `hero_id`, 127 únicas | I-7 — o espelho preserva conjunto **e** cardinalidade |
| herói `20` presente em dois grupos (`Grupo Um` e `Grupo Três`) | I-8 — herói repetido aparece nos dois grupos do espelho, com a mesma nota |
| catálogo praticamente inteiro dentro do layout | contraste: `outsideSource` fica **vazio** aqui |

A repetição do herói `20` **já existia no arquivo real** — foi verificada com `python3` antes de
gerar a fixture (128 entradas, 127 ids únicos, `{20: 2}`), então não foi preciso introduzir nenhuma
duplicação artificial. Nada de dado inventado nesta fixture.

O `.raw.txt` é o **texto** original (tabs de indentação, floats com 6 decimais, `[` em linha própria,
sem newline final), com os mesmos nomes anonimizados e **nada mais** alterado. É o alvo do teste
byte a byte de `valveJson.test.ts` (T014). `JSON.parse` do `.raw.txt` é igual em profundidade ao
`.json` — verificado com `python3`.

### O que a fixture real NÃO cobre

É o caso *atípico* de um jogador organizado, e deixa vazias justamente as invariantes mais
arriscadas:

- **um único layout** → não exercita I-2 (nenhum outro config alterado) nem I-4b (ordem do array
  `configs` preservada, espelho acrescentado no fim);
- **nenhum `config_name` repetido** → não exercita a identidade por posição (N-1, I-4);
- **nenhum `category_name` repetido** → não exercita I-4a, e nome repetido é caso **real** (o grid do
  Dota 2 Pro Tracker repete `Best with` sete vezes);
- **nenhum grupo vazio** → não exercita ordenação de lista vazia (I-9);
- **catálogo inteiro dentro do layout** → `outsideSource` nunca é populado;
- **`version: 3`** → um serializador que fixasse `3` passaria, escondendo a violação de I-3;
- **só campos conhecidos** → L-4 (preservar campo desconhecido na escrita) nunca é testado;
- **todos os `hero_ids` no catálogo** → L-5 (id desconhecido é preservado como "sem dado") nunca é
  testado.

Daí a anti-fixture.

## `hero-grid-adverse.json`

**Sintética** (nenhum dado de conta real), desenhada para ser o oposto do grid real.

| Característica | Onde está | Invariante / regra |
| --- | --- | --- |
| 3 layouts | `configs[0..2]` | I-2, I-4b — os outros configs não podem ser tocados e a ordem não muda |
| dois layouts com o **mesmo** `config_name` (`Meta Espelho`) | `configs[0]`, `configs[1]` | N-1, I-4 — identidade é a **posição**; por nome, o espelho se duplicaria |
| duas categorias de nome idêntico (`Best with`) | `configs[0].categories[0..1]` | I-4a — grupos homônimos são espelhados e ordenados independentemente |
| layout com **uma única** categoria | `configs[1]` | I-5 — borda de contagem de grupos |
| categoria **vazia** (`hero_ids: []`) | `configs[0].categories[2]` | I-9 — ordenar lista vazia é resultado válido, não erro |
| poucos heróis por grupo (7 ids, de ~127 do catálogo) | todos os grupos | `outsideSource` — a maioria do ranking fica fora do layout e **não** entra no espelho (FR-008a) |
| herói em **três** grupos (`20`) | `configs[0].categories[0]`, `configs[0].categories[1]`, `configs[1].categories[0]` | I-8 — mesma nota em todas as ocorrências, inclusive entre layouts |
| `version: 4` | raiz | I-3 — prova que o valor lido é preservado, não fixado em `3` |
| coordenadas fracionárias de 6 decimais | todas as categorias | FR-007c — estilo de serialização |
| campo desconhecido em `config` (`future_valve_config_field`) | `configs[1]` | L-4 — preservar na escrita |
| campo desconhecido em `category` (`future_valve_field: 7`) | `configs[0].categories[1]` | L-4 — preservar na escrita |
| `hero_id` fora do catálogo (`9999`) | `configs[1].categories[0]` | L-5 — preservar e tratar como "sem dado" |

Os demais ids (`1`, `8`, `12`, `20`, `32`, `41`, `67`) existem em `src/constants/heroes.ts`.
