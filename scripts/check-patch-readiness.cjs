/**
 * Confere se as APIs ja "viraram" para o patch novo — os gatilhos do §3.1 de
 * docs/PATCH-<patch>.md. So le; nao grava nada.
 *
 * O token da STRATZ é lido do proprio `stratz_app_config.json` do app (ou de
 * STRATZ_API_KEY) e vai direto para o header. Ele NUNCA é impresso, nem em erro: a
 * saida deste script pode ser colada em issue, log ou conversa com IA sem vazar nada.
 * O token nao é revogavel — manter essa propriedade ao mexer aqui.
 *
 * Editar as tres constantes abaixo a cada patch.
 *
 * Rodar da raiz do repo: node scripts/check-patch-readiness.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const PATCH = '7.42';
/** Itens compraveis que so existem a partir do patch. */
const NEW_ITEM_IDS = { 1942: 'Bloodslinger', 1944: "Ristul's Devotion", 1946: 'Starforge', 1948: 'Skypiercer', 1953: 'Sabatons of Mordiggian', 1955: 'Caduceus' };
/** Itens removidos no patch: enquanto aparecerem, o agregado ainda carrega o patch anterior. */
const REMOVED_ITEM_IDS = { 7: 'Javelin', 635: 'Helm of the Overlord', 1808: 'Khanda' };

/** Heroi + posicao para a sonda do itemFullPurchase. Variados de proposito. */
const PROBES = [
  { heroId: 1, name: 'Anti-Mage', position: 'POSITION_1' },
  { heroId: 74, name: 'Invoker', position: 'POSITION_2' },
  { heroId: 2, name: 'Axe', position: 'POSITION_3' },
  { heroId: 26, name: 'Lion', position: 'POSITION_4' },
  { heroId: 5, name: 'Crystal Maiden', position: 'POSITION_5' },
];

function readToken() {
  if (process.env.STRATZ_API_KEY) return process.env.STRATZ_API_KEY.trim();
  const home = os.homedir();
  const candidates = [
    path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'GlimpseGG'),
    path.join(home, 'Library', 'Application Support', 'GlimpseGG'),
    path.join(process.env.APPDATA || '', 'GlimpseGG'),
  ];
  for (const dir of candidates) {
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'stratz_app_config.json'), 'utf-8'));
      if (cfg.stratzApiKey) return String(cfg.stratzApiKey).trim();
    } catch {
      // proximo candidato
    }
  }
  return '';
}

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function stratz(token, query, variables) {
  const res = await fetch('https://api.stratz.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'STRATZ_API',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(60000),
  });
  // So o status: o corpo de erro nunca é repassado, para nao ecoar nada da requisicao.
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(`GraphQL: ${json.errors.map(e => e.message).join('; ')}`);
  return json.data;
}

const mark = ok => (ok ? '[ok]     ' : '[pendente]');
const line = (ok, text) => console.log(`${mark(ok)} ${text}`);

async function section(title, fn) {
  console.log(`\n== ${title}`);
  try {
    await fn();
  } catch (err) {
    console.log(`[erro]     ${err.message}`);
  }
}

async function main() {
  console.log(`Prontidao das APIs para o patch ${PATCH} — ${new Date().toISOString()}`);
  let patchDate = null;

  await section('Valve (datafeed)', async () => {
    const list = (await getJson('https://www.dota2.com/datafeed/patchnoteslist?language=english')).patches;
    const entry = list.find(p => p.patch_number === PATCH);
    const latest = list[list.length - 1];
    if (entry) patchDate = new Date(entry.patch_timestamp * 1000);
    line(!!entry, `patch ${PATCH} publicado em ${patchDate ? patchDate.toISOString() : '?'}`);
    line(latest.patch_number === PATCH, `patch mais recente na lista: ${latest.patch_number}` +
      (latest.patch_number !== PATCH ? ' — saiu sub-patch: rodar o sync de itens de novo' : ''));
  });

  await section('OpenDota (constantes)', async () => {
    const patches = await getJson('https://api.opendota.com/api/constants/patch');
    const ids = await getJson('https://api.opendota.com/api/constants/item_ids');
    const last = patches[patches.length - 1].name;
    const known = Object.keys(NEW_ITEM_IDS).filter(id => ids[id]);
    line(patches.some(p => p.name === PATCH), `constants/patch vai ate ${last}`);
    line(known.length === Object.keys(NEW_ITEM_IDS).length,
      `constants/item_ids conhece ${known.length} de ${Object.keys(NEW_ITEM_IDS).length} itens novos (${Object.keys(ids).length} ids no total)`);
  });

  const token = readToken();
  if (!token) {
    console.log('\n== STRATZ\n[pulado]   sem token (stratz_app_config.json do app ou STRATZ_API_KEY)');
    return;
  }

  await section('STRATZ — versoes', async () => {
    const data = await stratz(token, 'query { constants { gameVersions { id name } } }', {});
    const versions = [...data.constants.gameVersions].sort((a, b) => b.id - a.id);
    line(versions.some(v => v.name === PATCH || v.name.startsWith(PATCH)),
      `gameVersions mais recentes: ${versions.slice(0, 3).map(v => `${v.name} (#${v.id})`).join(', ')}`);
  });

  await section('STRATZ — itemFullPurchase (recomendador de build)', async () => {
    const query = `query($heroId: Short!, $positionIds: [MatchPlayerPositionType]) {
      heroStats { itemFullPurchase(heroId: $heroId, positionIds: $positionIds) { itemId matchCount } }
    }`;
    let anyNew = false;
    let anyRemoved = false;
    for (const probe of PROBES) {
      const data = await stratz(token, query, { heroId: probe.heroId, positionIds: [probe.position] });
      const totals = new Map();
      for (const row of data.heroStats.itemFullPurchase || []) {
        totals.set(row.itemId, (totals.get(row.itemId) || 0) + row.matchCount);
      }
      const describe = table => Object.entries(table)
        .filter(([id]) => totals.has(Number(id)))
        .map(([id, name]) => `${name} ${totals.get(Number(id))}`);
      const fresh = describe(NEW_ITEM_IDS);
      const stale = describe(REMOVED_ITEM_IDS);
      anyNew = anyNew || fresh.length > 0;
      anyRemoved = anyRemoved || stale.length > 0;
      const top = Math.max(0, ...totals.values());
      console.log(`           ${probe.name} ${probe.position}: ${totals.size} itens, maior amostra ${top}` +
        ` | novos: ${fresh.join(', ') || 'nenhum'} | removidos: ${stale.join(', ') || 'nenhum'}`);
    }
    line(anyNew, 'algum item novo do patch aparece no agregado');
    line(!anyRemoved, 'nenhum item removido aparece mais no agregado');
  });

  await section('STRATZ — winWeek (layout espelho)', async () => {
    const data = await stratz(token, 'query { heroStats { winWeek(take: 1) { week heroId matchCount } } }', {});
    const rows = data.heroStats.winWeek || [];
    const week = rows.length ? Math.max(...rows.map(r => r.week)) : null;
    const weekDate = week ? new Date(week * 1000) : null;
    const matches = rows.reduce((sum, r) => sum + r.matchCount, 0);
    line(!!(weekDate && patchDate && weekDate >= patchDate),
      `semana mais recente comeca em ${weekDate ? weekDate.toISOString() : '?'} — ${rows.length} herois, ${matches} partidas-heroi` +
      (weekDate && patchDate && weekDate < patchDate ? ' (comecou antes do patch: mistura os dois)' : ''));
  });
}

main().catch(err => {
  console.error(`Falhou: ${err.message}`);
  process.exit(1);
});
