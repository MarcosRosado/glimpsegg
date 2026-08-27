# Contrato: arquivo `hero_grid_config.json`

Contrato **externo** — o formato é da Valve, o app é convidado nele. Toda regra aqui existe porque o
arquivo pertence ao jogador e o cliente do Dota também escreve nele.

## Localização

```
<steamRoot>/userdata/<id3>/570/remote/cfg/hero_grid_config.json
```

`<steamRoot>` por plataforma:

| Plataforma | Candidatos, nesta ordem |
| --- | --- |
| Linux | `~/.steam/steam`, `~/.steam/root`, `~/.local/share/Steam`, `~/.var/app/com.valvesoftware.Steam/.local/share/Steam`, `~/snap/steam/common/.local/share/Steam` |
| Windows | `HKCU\Software\Valve\Steam\SteamPath`, depois `C:\Program Files (x86)\Steam` |
| macOS | `~/Library/Application Support/Steam` |

**Obrigatório**: resolver cada candidato por `realpath` e deduplicar. Em Linux os três primeiros
costumam apontar para o mesmo diretório (verificado). **Obrigatório**: em `userdata/`, aceitar só
nomes que sejam inteiro positivo — `0` e `anonymous` existem e não são contas.

## Formato

```json
{
  "version": 3,
  "configs": [
    {
      "config_name": "Layout1",
      "categories": [
        {
          "category_name": "Hcs Principais",
          "x_position": 43.478260,
          "y_position": 0.869565,
          "width": 290.434784,
          "height": 284.347839,
          "hero_ids": [20, 41, 12]
        }
      ]
    }
  ]
}
```

Serialização real da Valve: **tabs**, floats com **6 decimais**, `[` em linha própria depois de
`"configs":`. O serializador do app imita esse estilo (D-2) para o diff ficar mínimo.

## Regras de leitura

| # | Regra |
| --- | --- |
| L-1 | Arquivo ausente → estado `gridFileExists: false`, **não** erro e **não** criação de arquivo |
| L-2 | JSON inválido → abortar, informar, **não** sobrescrever |
| L-3 | `configs` ausente ou não-array → tratar como arquivo inválido (L-2) |
| L-4 | Campo desconhecido dentro de `config`/`category` → **preservar na escrita**. A Valve pode acrescentar campo em patch novo; descartar silenciosamente é perda de dado do jogador |
| L-5 | `hero_ids` com id desconhecido pelo catálogo do app → preservar, tratar como "sem dado" |

## Regras de escrita

| # | Regra | Requisito |
| --- | --- | --- |
| E-1 | Backup **byte a byte** do arquivo original antes de qualquer escrita, para `hero_grid_config.glimpse.bak.<epoch>` no mesmo diretório | FR-009 |
| E-2 | Escrita atômica: gravar em `hero_grid_config.json.glimpse.tmp` no mesmo diretório → `fsync` → `rename` sobre o original | FR-010 |
| E-3 | Antes do `rename`, o main faz `JSON.parse` do texto a gravar e compara o `HeroGridConfig` de origem por igualdade profunda com o que foi lido. Falhou → abortar, **não** gravar, reportar `SOURCE_MUTATED` | FR-007b |
| E-4 | Asserção equivalente para todo config que não é o espelho | FR-007a |
| E-5 | Uma escrita por vez, garantida por trava no main process | FR-012 |
| E-6 | Manter no máximo **5** backups; apagar os mais antigos | FR-037 |
| E-7 | Se o Dota 2 estiver rodando, **não** gravar sem confirmação explícita do jogador | FR-011 |
| E-8 | Sem permissão de escrita no diretório → falhar explicitamente, original intacto | edge case |

## Identidade: posição, nunca nome

Regra única e sem exceção: **layout e categoria são identificados pela posição no array; nome é
rótulo.**

Por quê, com evidência:

- O Dota 2 permite dois layouts com o mesmo `config_name`.
- O Dota 2 permite duas categorias com o mesmo `category_name`. **Isso é caso real, não hipótese**: o
  grid de meta publicado pelo próprio Dota 2 Pro Tracker repete `Best with` **sete vezes** dentro de
  um único layout (verificado no arquivo baixado).
- O jogador pode renomear qualquer um dos dois a qualquer momento, dentro do jogo.

Identidade por nome, portanto, perde o rastro do espelho num rename e cria um segundo na
sincronização seguinte — violando FR-008c.

| # | Regra | Requisito |
| --- | --- | --- |
| N-1 | Preferências guardam `{ index, name }` para origem e espelho. `index` é a identidade, `name` é o último nome conhecido | FR-008h |
| N-2 | Categoria é referenciada por posição dentro do layout. Nomes repetidos são espelhados e ordenados independentemente | FR-008i |
| N-3 | Se o layout na posição registrada tiver nome diferente do guardado, é **rename**: atualizar o `name` e seguir. Não é layout novo, não gera espelho novo | FR-008h |
| N-4 | Se a posição registrada não existir mais (layout apagado), avisar e pedir nova origem. Não adivinhar por nome | edge case |
| N-5 | Nome padrão do espelho: `"<origem> — GlimpseGG"`, renomeável. É rótulo, e renomear não muda nada de comportamento | FR-008b |
| N-6 | O espelho é acrescentado **no fim** do array `configs`. A posição dos layouts do jogador nunca muda — senão os `index` guardados apontariam para o layout errado | FR-007a, I-4b |
| N-7 | Layout que o app não criou nunca é sobrescrito, mesmo com nome idêntico ao do espelho | FR-008e |

## O que o contrato NÃO permite

- Criar o arquivo quando ele não existe.
- Remover config que o app não criou.
- Alterar `version`.
- Reordenar o array `configs` (a posição do layout do jogador na lista é escolha dele).
- Escrever qualquer coisa com a feature desligada.
