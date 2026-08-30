# src/constants/

Metadados estáticos do Dota e constantes de domínio. **É a pasta onde patch novo dá trabalho** —
e onde o dado envelhecido não quebra nada visivelmente, só empobrece a tela em silêncio.

## Arquivos

| Arquivo | Papel | Como é mantido |
| --- | --- | --- |
| `items.ts` | `ITEMS_MAP` (id → nome, custo, ícone), `getItem`, `isNeutralItem` | **Gerado**: `node scripts/sync-items-full.cjs`, a partir das constantes da OpenDota |
| `heroes.ts` | `HEROES_MAP`, `getHero`, `registerDynamicHeroes` | **Manual**, herói a herói |
| `abilities.ts` | `HERO_ABILITIES_MAP`, `getHeroAbilities` | **Manual** — só **13** heróis mapeados; o resto cai num fallback genérico Q/W/E/R montado pelo `shortName` |
| `mapGeometry.ts` | Espaço de células da STRATZ, `MAP_IMAGE_INSET`, raios e duração de ward, `STRATZ_WARD_TYPE_INT` | Calibrado por medição documentada no topo do arquivo |
| `baselines.ts` | `ROLE_BASELINES` por posição + `getRoleBaseline` | Números à mão, por posição |
| `counterItems.ts` | `COUNTER_ITEMS`: itens de resposta por arquétipo de ameaça (7 arquétipos) | Curadoria pequena e deliberada |
| `gameVersion.ts` | Só `CURRENT_GAME_PATCH` | Piso de fallback; em runtime o patch vem de `services/gameVersionService.ts` |
| `ranks.ts` | `RANK_NAMES`, `RANK_COLORS`, `getRankTierInfo`, `getBracketBadge` | Tiers de medalha; muda quando a Valve mexe no sistema de ranque |

## Regras locais

- **`getHero`/`getItem`/`getHeroAbilities` sempre devolvem fallback, nunca `undefined`.** É o que
  permite abrir uma partida com herói ou item de patch novo sem quebrar a tela — mas o custo é
  **falha silenciosa**: aparece `Hero #<id>`, `Item #<id>`, ícone de recipe e "Skill Q/W/E/R". Nada
  loga, nada avisa. É por isso que existe o checklist de patch.
- `heroes.ts` exporta `registerDynamicHeroes`, e **ninguém chama essa função** em todo o repo. É
  gancho morto, não mecanismo ativo — usar (alimentando com o catálogo da OpenDota) ou remover é
  decisão pendente. Não assuma que o `HEROES_MAP` se atualiza sozinho em runtime: ele não se
  atualiza.
- `mapGeometry.ts` só se altera **refazendo a calibração** contra `public/minimap.png` (amostra de
  544 wards reais e âncoras de runa, tudo no comentário de topo; verificado por
  `tests/utils/minimapCoords.test.ts`). Trocar a imagem do minimapa **invalida** `MAP_IMAGE_INSET`.
- `ROLE_BASELINES` é a fonte do `BenchmarkSource.ROLE_BASELINE`. Todo número que sai dele **tem** de
  chegar à tela rotulado como estimativa — ver a doutrina em [../../CLAUDE.md](../../CLAUDE.md).
- Em `counterItems.ts`, item entra só se for resposta **canônica** ao arquétipo. Nada de matriz de
  counter por herói: o comentário de topo explica por que a alternativa foi descartada. Quem filtra
  o que é bom naquele patch é o win rate do `itemFullPurchase`, não este arquivo.
- `roles` do `HEROES_MAP` é notoriamente ruim (Axe e Bane saem ambos como `["Carry","Support"]`).
  Não usar como sinal de posição — quem resolve posição é `utils/rankBracket.ts`.

## Ao sair um patch

Não há gate automático sobre esta pasta — o roteiro é manual, nesta ordem:

1. **Itens**: rodar `node scripts/sync-items-full.cjs` e commitar o diff de `items.ts`. Item
   removido ou com id refeito também quebra `ITEM_BENCHMARKS` em `../utils/performanceEnricher.ts`
   e os ids de `counterItems.ts` — ambos em silêncio.
2. **Herói novo**: entrada à mão em `heroes.ts`; sem ela, `Hero #<id>` na tela inteira. As
   habilidades em `abilities.ts` são opcionais (há fallback), mas o fallback mostra "Skill Q".
3. **Visão**: se o patch mexeu em alcance ou duração de ward, editar `OBSERVER_VISION_UNITS`,
   `SENTRY_TRUE_SIGHT_UNITS`, `OBSERVER_DURATION_SEC`, `SENTRY_DURATION_SEC` (o comentário diz
   "patch 7.4x — um patch novo = uma edição aqui").
4. **Mapa redesenhado**: recalibrar `MAP_IMAGE_INSET` antes de trocar `public/minimap.png`.
5. `CURRENT_GAME_PATCH` é só o piso do fallback — não é onde o patch "entra" no app.

Ver também: [../CLAUDE.md](../CLAUDE.md) · [../utils/CLAUDE.md](../utils/CLAUDE.md) ·
[docs/PATCH-CHECKLIST.md](../../docs/PATCH-CHECKLIST.md)
