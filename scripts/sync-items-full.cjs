/**
 * Regenera src/constants/items.ts.
 *
 * TRES CAMADAS, DA MAIS FRACA PARA A MAIS FORTE
 * ---------------------------------------------
 *  1. O proprio items.ts atual. É a base porque item que saiu do jogo some das duas
 *     APIs, mas continua aparecendo em partida antiga — sem essa camada, Javelin de
 *     uma partida de 7.41 viraria "Item #7".
 *  2. OpenDota (`constants/item_ids` + `constants/items`). Opcional: se cair, o sync
 *     segue sem ela.
 *  3. Datafeed da Valve (`itemlist` + `itemdata` por id). Vence as outras duas.
 *
 * POR QUE A VALVE VENCE: 13 horas depois do 7.42 sair, a OpenDota ainda servia o
 * catalogo antigo (`constants/patch` parava em 7.41 e `item_ids` nao tinha nenhum dos
 * 23 ids novos), enquanto o datafeed que alimenta dota2.com/patches ja servia custo e tier
 * no dia do patch. A versao anterior deste script lia so a OpenDota, entao rodar o
 * checklist no dia do patch nao mudava nada — em silencio.
 *
 * `neutral_item_tier` da Valve é base 0 (-1 = nao é neutro); `tier` aqui é base 1.
 * Item "cycled out" volta -1: o tier antigo é preservado para a partida antiga
 * continuar legivel.
 *
 * Rodar da raiz do repo: node scripts/sync-items-full.cjs
 */
const fs = require('fs');

const ITEMS_TS = 'src/constants/items.ts';
const VALVE_IMG_BASE = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items';
const VALVE_FEED = 'https://www.dota2.com/datafeed';
const OPENDOTA = 'https://api.opendota.com/api/constants';
const CONCURRENCY = 8;

async function getJson(url, attempts = 3) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error(`${url}: ${lastError.message}`);
}

async function mapPool(list, worker) {
  const out = new Array(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < list.length) {
        const i = next++;
        out[i] = await worker(list[i]);
      }
    })
  );
  return out;
}

const withPrefix = name => (name.startsWith('item_') ? name : `item_${name}`);
const isRecipeName = name => name.startsWith('item_recipe_');
const titleCase = name =>
  name.replace(/^item_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const imageFor = name =>
  isRecipeName(name) ? `${VALVE_IMG_BASE}/recipe.png` : `${VALVE_IMG_BASE}/${name.replace(/^item_/, '')}.png`;

/** Camada 1: o catalogo commitado. */
function readCurrentCatalog() {
  if (!fs.existsSync(ITEMS_TS)) return {};
  const src = fs.readFileSync(ITEMS_TS, 'utf-8');
  const match = src.match(/ITEMS_MAP: Record<number, ItemMetadata> = (\{[\s\S]*?\n\});/);
  if (!match) throw new Error(`Nao achei o ITEMS_MAP em ${ITEMS_TS} — o formato do arquivo mudou?`);
  return JSON.parse(match[1]);
}

/** Camada 2: OpenDota. Devolve {} se estiver fora do ar. */
async function readOpenDota() {
  try {
    const [idMap, items] = await Promise.all([
      getJson(`${OPENDOTA}/item_ids`),
      getJson(`${OPENDOTA}/items`),
    ]);
    const out = {};
    const skipped = [];
    for (const [idStr, shortName] of Object.entries(idMap)) {
      // `item_ids` lista id que `items` nao descreve: no 7.42 vieram 1876 (invocacao do
      // urso do Lone Druid), 1912 e 1914 (talentos do Venomancer). Sem esta trava o merge
      // fabricava a entrada inteira — nome por titleCase, `isNeutral: true` por ter custo
      // 0 e uma imageUrl que da 404. Id sem descricao nao é item: fica de fora, e se um
      // dia aparecer em partida o `getItem` ja devolve fallback rotulado.
      if (!items[shortName]) {
        skipped.push(`${idStr} ${shortName}`);
        continue;
      }
      const details = items[shortName];
      out[idStr] = {
        name: withPrefix(shortName),
        displayName: details.dname,
        cost: details.cost,
        tier: details.tier,
      };
    }
    if (skipped.length) {
      console.log(`OpenDota: ${skipped.length} ids sem descricao em constants/items, ignorados:\n  ${skipped.join('\n  ')}`);
    }
    return out;
  } catch (err) {
    console.warn(`OpenDota indisponivel, seguindo sem ela: ${err.message}`);
    return {};
  }
}

/** Camada 3: datafeed da Valve. Falha aqui aborta — sem ela o sync nao é confiavel. */
async function readValve() {
  const list = (await getJson(`${VALVE_FEED}/itemlist?language=english`)).result.data.itemabilities;
  console.log(`Valve: ${list.length} itens na lista, buscando o custo de cada um...`);
  const details = await mapPool(list, async entry => {
    const data = await getJson(`${VALVE_FEED}/itemdata?language=english&item_id=${entry.id}`);
    return data.result.data.items[0] || null;
  });
  const out = {};
  list.forEach((entry, i) => {
    out[entry.id] = {
      name: entry.name,
      displayName: (entry.name_english_loc || '').replace(/\s+/g, ' ').trim() || undefined,
      cost: details[i] ? details[i].item_cost : undefined,
      tier: entry.neutral_item_tier >= 0 ? entry.neutral_item_tier + 1 : undefined,
    };
  });
  return out;
}

function mergeCatalog(current, openDota, valve) {
  const ids = new Set([...Object.keys(current), ...Object.keys(openDota), ...Object.keys(valve)]);
  const catalog = {};
  for (const idStr of [...ids].sort((a, b) => Number(a) - Number(b))) {
    const cur = current[idStr] || {};
    const od = openDota[idStr] || {};
    const vl = valve[idStr] || {};
    const pick = key => vl[key] ?? od[key] ?? cur[key];

    const name = pick('name');
    const cost = pick('cost') || 0;
    const tier = pick('tier');
    catalog[idStr] = {
      id: Number(idStr),
      name,
      displayName: pick('displayName') || titleCase(name),
      cost,
      // Tem tier, ou nao se compra (Aegis, drops, encantamentos). Receita sem custo nao
      // conta, e id que ja estava no catalogo so muda de false para true ao ganhar tier:
      // a Valve devolve custo 0 onde a OpenDota omitia o campo, e sem essa trava 106
      // itens (receitas inclusive) viravam "neutros" na primeira execucao.
      isNeutral:
        tier !== undefined ||
        (current[idStr] ? !!cur.isNeutral : cost === 0 && !isRecipeName(name)),
      tier,
      imageUrl: imageFor(name),
    };
  }
  return catalog;
}

function reportDiff(before, after) {
  const added = [];
  const cost = [];
  const tier = [];
  for (const [id, item] of Object.entries(after)) {
    const old = before[id];
    if (!old) {
      added.push(`  + ${id} ${item.name} (${item.cost}g${item.tier ? `, tier ${item.tier}` : ''})`);
      continue;
    }
    if (old.cost !== item.cost) cost.push(`  ~ ${id} ${item.name}: ${old.cost} -> ${item.cost}`);
    if (old.tier !== item.tier) tier.push(`  ~ ${id} ${item.name}: tier ${old.tier} -> ${item.tier}`);
  }
  console.log(`\nItens novos (${added.length}):\n${added.join('\n')}`);
  console.log(`\nCusto alterado (${cost.length}):\n${cost.join('\n')}`);
  console.log(`\nTier alterado (${tier.length}):\n${tier.join('\n')}`);
}

function render(catalog) {
  return `import { ItemMetadata } from "../types/dota";

const VALVE_ITEM_IMG_BASE = "${VALVE_IMG_BASE}";

export const ITEMS_MAP: Record<number, ItemMetadata> = ${JSON.stringify(catalog, null, 2)};

/**
 * Returns item metadata with dynamic fallback if not found
 */
export function getItem(itemId: number): ItemMetadata {
  if (!itemId || itemId === 0) {
    return {
      id: 0,
      name: "empty",
      displayName: "Empty Slot",
      cost: 0,
      isNeutral: false,
      imageUrl: "",
    };
  }

  const existing = ITEMS_MAP[itemId];
  if (existing) {
    if (existing.name.startsWith('item_recipe_') || existing.name.includes('recipe')) {
      return {
        ...existing,
        imageUrl: \`\${VALVE_ITEM_IMG_BASE}/recipe.png\`,
      };
    }
    return existing;
  }

  const fallbackShort = \`item_\${itemId}\`;
  return {
    id: itemId,
    name: fallbackShort,
    displayName: \`Item #\${itemId}\`,
    cost: 0,
    isNeutral: false,
    imageUrl: \`\${VALVE_ITEM_IMG_BASE}/recipe.png\`,
  };
}

export function isNeutralItem(itemId: number): boolean {
  const item = getItem(itemId);
  return item.isNeutral;
}
`;
}

async function main() {
  const current = readCurrentCatalog();
  const [openDota, valve] = await Promise.all([readOpenDota(), readValve()]);
  console.log(
    `Fontes: items.ts ${Object.keys(current).length} · OpenDota ${Object.keys(openDota).length} · Valve ${Object.keys(valve).length}`
  );

  const catalog = mergeCatalog(current, openDota, valve);
  reportDiff(current, catalog);

  fs.writeFileSync(ITEMS_TS, render(catalog), 'utf-8');
  console.log(`\n${ITEMS_TS} regravado com ${Object.keys(catalog).length} itens.`);
}

main().catch(err => {
  console.error(`Sync abortado, ${ITEMS_TS} nao foi tocado: ${err.message}`);
  process.exit(1);
});
