const fs = require('fs');

async function syncAllDotaItems() {
  console.log('Fetching full OpenDota items catalog...');
  const idMapRes = await fetch('https://api.opendota.com/api/constants/item_ids');
  const idMap = await idMapRes.json();

  const itemsRes = await fetch('https://api.opendota.com/api/constants/items');
  const itemsObj = await itemsRes.json();

  const VALVE_BASE = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items';

  const completeCatalog = {};

  for (const [idStr, internalName] of Object.entries(idMap)) {
    const id = parseInt(idStr, 10);
    const details = itemsObj[internalName] || {};

    const isRecipe = internalName.startsWith('recipe_') || internalName.startsWith('item_recipe_');
    const isNeutral = details.tier !== undefined || details.cost === 0;

    let imgShort = internalName.replace(/^item_/, '');
    let imageUrl = isRecipe ? `${VALVE_BASE}/recipe.png` : `${VALVE_BASE}/${imgShort}.png`;

    const displayName = details.dname || internalName.replace(/^item_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    completeCatalog[id] = {
      id,
      name: internalName.startsWith('item_') ? internalName : `item_${internalName}`,
      displayName,
      cost: details.cost || 0,
      isNeutral: !!isNeutral,
      tier: details.tier,
      imageUrl
    };
  }

  console.log('Total synced items:', Object.keys(completeCatalog).length);

  // Check 1858-1862 specifically
  [1858, 1859, 1860, 1861, 1862].forEach(id => {
    console.log(`Verified item ${id}:`, completeCatalog[id]);
  });

  const fileContent = `import { ItemMetadata } from "../types/dota";

const VALVE_ITEM_IMG_BASE = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items";

export const ITEMS_MAP: Record<number, ItemMetadata> = ${JSON.stringify(completeCatalog, null, 2)};

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

  fs.writeFileSync('src/constants/items.ts', fileContent, 'utf-8');
  console.log('src/constants/items.ts successfully updated with all 596+ Dota 2 items!');
}

syncAllDotaItems();
