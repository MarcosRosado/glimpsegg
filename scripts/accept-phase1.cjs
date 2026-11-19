/**
 * Aceite da Fase 1 de docs/PLANO-OPENDOTA.md: roda o `mapOpenDotaMatch` DE VERDADE sobre a
 * metade OpenDota de cada par de `.gabarito/pairs/` e compara a SAIDA do mapper com os campos
 * da STRATZ do mesmo par.
 *
 *   node scripts/accept-phase1.cjs               relatorio por estrato + divergencias (ate 40)
 *   node scripts/accept-phase1.cjs --all         lista todas as divergencias
 *   node scripts/accept-phase1.cjs <diretorio>   outro diretorio de pares (padrao .gabarito/pairs)
 *
 * Criterio (plano, Fase 1): KDA, itens, patrimonio final, contagem de wards e de mortes
 * IDENTICOS aos da STRATZ; posicao igual em pelo menos 95%. Reportado por faixa de ranque,
 * por duracao e por patch, porque media geral esconde erro em partida curta (§5).
 *
 * O MAPPER NAO É COPIADO. Ele é TypeScript com imports sem extensao, entao o Node nao o
 * carrega sozinho; quem carrega é o `runnerImport` do Vite — o mesmo transformador do build —
 * direto de `src/services/openDotaMatch.ts`. Uma segunda implementacao em .cjs passaria no
 * aceite medindo a si mesma. O que se mede aqui é o codigo que o app embarca.
 *
 * Regras de leitura do numero:
 *  - Campo que a STRATZ nao devolveu (null, ou par colhido antes de o campo existir em
 *    STRATZ_FIELDS) SAI DO DENOMINADOR e é contado em "sem gabarito". Nao vira acerto nem erro.
 *  - Este script nunca ajusta nada para passar: divergencia é listada com os dois valores.
 *  - Celula de estrato com menos de 50 pares deixa o veredito como PARCIAL, mesmo com 100%.
 *
 * Totalmente offline: nao le token, nao toca a rede. Rodar da raiz.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pathToFileURL } = require('url');

const RANKS = ['HERALD_GUARDIAN', 'CRUSADER_ARCHON', 'LEGEND_ANCIENT', 'DIVINE', 'IMMORTAL'];
const DURS = ['LT25', '25_40', 'GT40'];
const TARGET_PER_CELL = 50;
const POSITION_MIN = 0.95;

/** `exact: true` = o plano exige identico; posicao tem piso proprio. */
const CHECKS = [
  { key: 'kda', label: 'KDA', exact: true },
  { key: 'items', label: 'itens', exact: true },
  { key: 'networth', label: 'patrimonio', exact: true },
  { key: 'wards', label: 'wards', exact: true },
  { key: 'deaths', label: 'mortes', exact: true },
  { key: 'position', label: 'posicao', exact: false },
  // Fora do criterio do plano; medidos porque o mapper os preenche e a STRATZ os tem.
  { key: 'neutral', label: 'neutro', extra: true },
  { key: 'backpack', label: 'mochila', extra: true },
  { key: 'lhdn', label: 'cs/denies', extra: true },
];

const sortedIds = (list) => list.map((v) => Number(v) || 0).sort((a, b) => a - b).join(',');
const hasAll = (obj, keys) => keys.every((k) => obj[k] !== undefined);

/**
 * Compara um jogador. Devolve, por check, `null` (sem gabarito) ou `{ ok, mapper, stratz }`.
 * `mp` é o MatchPlayer que saiu do mapper; `sp` é o jogador cru da STRATZ.
 */
function comparePlayer(mp, sp) {
  const out = {};
  const put = (key, has, mapper, stratz) => {
    out[key] = has ? { ok: mapper === stratz, mapper, stratz } : null;
  };
  const nums = (...v) => v.every((x) => typeof x === 'number');

  put('kda', nums(sp.kills, sp.deaths, sp.assists),
    `${mp.kills}/${mp.deaths}/${mp.assists}`, `${sp.kills}/${sp.deaths}/${sp.assists}`);

  const itemKeys = ['item0Id', 'item1Id', 'item2Id', 'item3Id', 'item4Id', 'item5Id'];
  // Multiconjunto: a ordem dos slots do inventario nao é a mesma nas duas APIs.
  put('items', hasAll(sp, itemKeys), sortedIds(mp.items || []), sortedIds(itemKeys.map((k) => sp[k])));

  put('networth', nums(sp.networth), mp.networth, sp.networth);

  const sw = sp.stats?.wards;
  // `wardEvents` undefined = o mapper nao achou dado de visao: é divergencia, nao zero.
  put('wards', Array.isArray(sw), Array.isArray(mp.wardEvents) ? mp.wardEvents.length : 'sem dado', Array.isArray(sw) ? sw.length : null);

  const sd = sp.stats?.deathEvents;
  // null no mapper = nenhuma morte registrada, que é 0 eventos.
  put('deaths', Array.isArray(sd), (mp.deathEvents || []).length, Array.isArray(sd) ? sd.length : null);

  put('position', typeof sp.position === 'string' && /^POSITION_[1-5]$/.test(sp.position),
    mp.position ?? 'UNKNOWN', sp.position);

  put('neutral', sp.neutral0Id !== undefined, Number(mp.neutralItem) || 0, Number(sp.neutral0Id) || 0);
  const bpKeys = ['backpack0Id', 'backpack1Id', 'backpack2Id'];
  put('backpack', hasAll(sp, bpKeys), sortedIds(mp.backpack || []), sortedIds(bpKeys.map((k) => sp[k])));
  put('lhdn', nums(sp.numLastHits, sp.numDenies), `${mp.numLastHits}/${mp.numDenies}`, `${sp.numLastHits}/${sp.numDenies}`);
  return out;
}

const newTally = () => Object.fromEntries(CHECKS.map((c) => [c.key, { ok: 0, n: 0, missing: 0 }]));

async function loadMapper() {
  // `vite` é ESM e é dependencia do repo, nao deste arquivo: resolve a partir da raiz.
  const vite = await import(pathToFileURL(require.resolve('vite', { paths: [process.cwd()] })).href);
  const { module: mod } = await vite.runnerImport(path.resolve('src/services/openDotaMatch.ts'), {
    configFile: false,
    logLevel: 'error',
  });
  if (typeof mod.mapOpenDotaMatch !== 'function') throw new Error('openDotaMatch.ts nao exporta mapOpenDotaMatch');
  return mod.mapOpenDotaMatch;
}

function pctCell(t) {
  if (!t.n) return '      n/d';
  const p = (100 * t.ok) / t.n;
  // 100% so aparece quando é 100 de verdade: 99,96% arredondado esconderia a divergencia.
  const txt = t.ok === t.n ? '100%' : `${Math.min(p, 99.9).toFixed(1)}%`;
  return txt.padStart(9);
}

function table(title, rows, checks) {
  console.log(`\n${title}`);
  console.log('estrato'.padEnd(17) + 'pares'.padStart(6) + checks.map((c) => c.label.padStart(11)).join(''));
  for (const [name, r] of rows) {
    console.log(name.padEnd(17) + String(r.matches).padStart(6) + checks.map((c) => `  ${pctCell(r.tally[c.key])}`).join(''));
  }
}

(async () => {
  const args = process.argv.slice(2);
  const showAll = args.includes('--all');
  const dir = path.resolve(args.find((a) => !a.startsWith('--')) || path.join('.gabarito', 'pairs'));
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((n) => n.endsWith('.json.gz')).sort();
  } catch {
    // tratado abaixo
  }
  if (!files.length) {
    console.log(`nenhum par em ${path.relative(process.cwd(), dir) || dir}. Rode scripts/collect-pairs.cjs antes.`);
    process.exit(1);
  }
  let index = { pairs: {} };
  try {
    index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf-8'));
  } catch {
    // sem indice: todos os pares caem em "fora do indice"
  }

  const mapOpenDotaMatch = await loadMapper();

  const group = () => ({ matches: 0, tally: newTally() });
  const total = group();
  const byRank = new Map(RANKS.map((r) => [r, group()]));
  const byDur = new Map(DURS.map((d) => [d, group()]));
  // Par colhido antes das trilhas nao tem `patch` no indice: sao todos 7.42 (conferido).
  const byPatch = new Map(['7.41', '7.42'].map((v) => [v, group()]));
  const cellCount = {};
  const diverg = [];
  const problems = { foraDoIndice: 0, ilegivel: 0, mapperLancou: 0, jogadorSemPar: 0, heroiDiferente: 0 };
  const vision = { unattributed: 0, dropped: 0, sources: {} };

  for (const name of files) {
    const id = name.replace('.json.gz', '');
    const entry = index.pairs?.[id];
    if (!entry || !byRank.has(entry.rank) || !byDur.has(entry.dur)) { problems.foraDoIndice++; continue; }
    let pair;
    try {
      pair = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, name))).toString('utf-8'));
    } catch {
      problems.ilegivel++;
      continue;
    }
    let mapped;
    try {
      mapped = mapOpenDotaMatch(pair.od);
    } catch (e) {
      problems.mapperLancou++;
      diverg.push({ id, slot: '-', hero: '-', field: 'mapper lancou', mapper: String(e.message).slice(0, 80), stratz: '' });
      continue;
    }
    const groups = [total, byRank.get(entry.rank), byDur.get(entry.dur), byPatch.get(entry.patch || '7.42')].filter(Boolean);
    for (const g of groups) g.matches++;
    cellCount[`${entry.rank}|${entry.dur}`] = (cellCount[`${entry.rank}|${entry.dur}`] || 0) + 1;
    vision.unattributed += mapped.vision?.unattributedWards || 0;
    vision.dropped += mapped.vision?.droppedEvents || 0;
    vision.sources[mapped.vision?.source] = (vision.sources[mapped.vision?.source] || 0) + 1;

    const bySlot = new Map(mapped.players.map((p) => [p.playerSlot, p]));
    for (const sp of pair.st?.players || []) {
      const mp = bySlot.get(sp.playerSlot);
      if (!mp) { problems.jogadorSemPar++; continue; }
      // Slot igual com heroi diferente = o par nao é da mesma partida; comparar seria ruido.
      if (mp.heroId !== sp.heroId) { problems.heroiDiferente++; continue; }
      const res = comparePlayer(mp, sp);
      for (const c of CHECKS) {
        const r = res[c.key];
        for (const g of groups) {
          const t = g.tally[c.key];
          if (!r) t.missing++;
          else { t.n++; if (r.ok) t.ok++; }
        }
        if (r && !r.ok) diverg.push({ id, slot: sp.playerSlot, hero: sp.heroId, field: c.label, mapper: r.mapper, stratz: r.stratz, cell: `${entry.rank}|${entry.dur}` });
      }
    }
  }

  const core = CHECKS.filter((c) => !c.extra);
  const extra = CHECKS.filter((c) => c.extra);
  console.log(`ACEITE DA FASE 1 — saida do mapOpenDotaMatch x STRATZ | pares: ${total.matches} de ${files.length} arquivos | unidade: jogador`);
  const bad = Object.entries(problems).filter(([, n]) => n > 0);
  if (bad.length) console.log('fora da conta: ' + bad.map(([k, n]) => `${k} ${n}`).join(' | '));

  table('POR FAIXA DE RANQUE', [...byRank], core);
  table('POR DURACAO', [...byDur], core);
  table('POR PATCH (o patch vem da OpenDota)', [...byPatch], core);
  table('TOTAL', [['todos', total]], core);
  console.log('\nacertos/comparados (sem gabarito na STRATZ):');
  for (const c of CHECKS) {
    const t = total.tally[c.key];
    console.log(`  ${c.label.padEnd(11)} ${t.ok}/${t.n}${t.missing ? ` (sem gabarito: ${t.missing})` : ''}${c.extra ? '  [fora do criterio]' : ''}`);
  }
  table('FORA DO CRITERIO DO PLANO', [['todos', total]], extra);
  console.log(`\nvisao no mapper: fonte ${JSON.stringify(vision.sources)} | wards sem autor: ${vision.unattributed} | eventos descartados (coordenada invalida): ${vision.dropped}`);

  console.log('\nPARES POR CELULA, os dois patches somados (meta: 50 em cada, por patch — ver collect-pairs --status)');
  console.log(' '.repeat(17) + DURS.map((d) => d.padStart(7)).join(''));
  let short = 0;
  for (const r of RANKS) {
    console.log(r.padEnd(17) + DURS.map((d) => {
      const n = cellCount[`${r}|${d}`] || 0;
      if (n < TARGET_PER_CELL) short++;
      return String(n).padStart(7);
    }).join(''));
  }

  if (diverg.length) {
    const byField = {};
    for (const d of diverg) byField[d.field] = (byField[d.field] || 0) + 1;
    console.log(`\nDIVERGENCIAS: ${diverg.length} — ${Object.entries(byField).map(([k, n]) => `${k} ${n}`).join(' | ')}`);
    const shown = showAll ? diverg : diverg.slice(0, 40);
    for (const d of shown) {
      console.log(`  ${d.id} slot ${String(d.slot).padStart(3)} heroi ${String(d.hero).padStart(3)} ${String(d.field).padEnd(11)} mapper=${d.mapper} stratz=${d.stratz}${d.cell ? `  [${d.cell}]` : ''}`);
    }
    if (shown.length < diverg.length) console.log(`  … mais ${diverg.length - shown.length} (use --all)`);
  }

  // Veredito: o criterio vale em CADA estrato com dado, nao so no total.
  const failures = [];
  const strata = [['total', total], ...byRank, ...byDur, ...byPatch];
  for (const c of core) {
    if (!total.tally[c.key].n) { failures.push(`${c.label}: sem gabarito em nenhum par`); continue; }
    for (const [name, g] of strata) {
      const t = g.tally[c.key];
      if (!t.n) continue;
      const pass = c.exact ? t.ok === t.n : t.ok / t.n >= POSITION_MIN;
      if (!pass) failures.push(`${c.label} em ${name}: ${t.ok}/${t.n}`);
    }
  }
  console.log('\nVEREDITO');
  if (failures.length) {
    console.log('  NAO PASSA:');
    for (const f of failures) console.log('   - ' + f);
  } else {
    console.log(`  criterio atendido em todo estrato com dado (identico em KDA, itens, patrimonio, wards e mortes; posicao >= ${POSITION_MIN * 100}%).`);
  }
  console.log(short
    ? `  COBERTURA PARCIAL: ${short}/15 celulas com menos de ${TARGET_PER_CELL} pares — o aceite so fecha com a coleta completa.`
    : '  cobertura completa: nenhuma celula abaixo de 50 pares.');
  process.exitCode = failures.length ? 1 : 0;
})().catch((e) => {
  console.log('erro:', e.message);
  process.exit(1);
});
