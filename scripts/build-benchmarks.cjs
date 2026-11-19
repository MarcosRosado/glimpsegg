/**
 * Agregador dos benchmarks proprios — Fase 2 de docs/PLANO-OPENDOTA.md. Transforma a base
 * so-OpenDota ja colhida (`.gabarito/pairs/` + `.gabarito/matches/`) em curvas por minuto,
 * por heroi e posicao, com QUANTIS.
 *
 *   node scripts/build-benchmarks.cjs            agrega tudo e grava .gabarito/benchmarks/<patch>.json
 *   node scripts/build-benchmarks.cjs --show 1:1   imprime a celula heroi 1, posicao 1 (ou 1:core)
 *
 * O QUE SAI. Para cada patch, dois niveis da hierarquia do plano:
 *   heroPosition  heroi x posicao (1..5)        — nivel 1, o alvo
 *   heroRole      heroi x core/suporte          — nivel 2, quando a celula de posicao é rasa
 * Em cada celula, para cada metrica e cada minuto de 0 a 60: n, media, p25, p50, p75.
 * Todas as series sao CUMULATIVAS, como vem nos arrays `*_t` da OpenDota (indice i = valor
 * no minuto i). O n cai com o minuto: so entra quem ainda estava em jogo — a mesma regra da
 * fotografia da STRATZ, e o motivo de o n vir por minuto e nao por celula.
 *
 * O QUE NAO SAI, de proposito:
 *  - Abates, mortes e assistencias por minuto: a OpenDota nao tem serie `*_t` para eles
 *    (ha `kills_log` e `deaths_log`, e nada para assistencia). Nao se aproxima.
 *  - Recorte por faixa de ranque: o plano o quer como ajuste escalar sobre a curva, nao como
 *    celula. Fica para depois que as curvas passarem no aceite.
 *  - Celula com menos de `MIN_EMIT` linhas, e minuto com menos de `MIN_EMIT` jogadores.
 *
 * PISO. `sufficient` marca a celula com `MIN_CELL` (200) linhas ou mais — a unica que pode
 * virar benchmark no app. As mais rasas saem no arquivo so para acompanhamento; o arquivo é
 * regua interna (fora do git) e é REGRAVADO a cada execucao, porque é derivado: a fonte de
 * verdade sao as partidas em disco. Publicar para o app é outro passo, que depende do aceite
 * (`benchmark-coverage.cjs`) e da decisao D6.
 *
 * Totalmente offline: nao le token, nao toca a rede. Rodar da raiz.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DATA_DIR = path.join(process.cwd(), '.gabarito');
const PATCH_BY_OD_ID = { 60: '7.41', 61: '7.42' };
const MIN_CELL = 200;
const MIN_EMIT = 30;
const MAX_MINUTE = 60;
const SLOTS = MAX_MINUTE + 1;
/** [nome na saida, array da OpenDota]. */
const METRICS = [
  ['networth', 'networth_t'],
  ['gold', 'gold_t'],
  ['xp', 'xp_t'],
  ['lastHits', 'lh_t'],
  ['denies', 'dn_t'],
  ['heroDamage', 'hero_damage_t'],
  ['towerDamage', 'tower_damage_t'],
  ['heroHealing', 'hero_healing_t'],
  ['campsStacked', 'camps_stacked_t'],
];
const MISSING = -1;

function listGz(dir) {
  try {
    return fs.readdirSync(dir).filter((n) => n.endsWith('.json.gz')).map((n) => path.join(dir, n));
  } catch {
    return [];
  }
}

/** Quantil por interpolacao linear sobre vetor JA ordenado. */
function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
const round = (v) => Math.round(v * 10) / 10;

function summarize(rows, rowIdx) {
  const byMinute = {};
  for (let m = 0; m < METRICS.length; m++) {
    const out = [];
    for (let t = 0; t < SLOTS; t++) {
      const vals = [];
      for (const i of rowIdx) {
        const v = rows[i].data[m * SLOTS + t];
        if (v !== MISSING) vals.push(v);
      }
      if (vals.length < MIN_EMIT) { out.push(null); continue; }
      vals.sort((a, b) => a - b);
      let sum = 0;
      for (const v of vals) sum += v;
      out.push({ n: vals.length, mean: round(sum / vals.length), p25: round(quantile(vals, 0.25)), p50: round(quantile(vals, 0.5)), p75: round(quantile(vals, 0.75)) });
    }
    // Corta a cauda de nulos: minuto que ninguem (ou quase ninguem) alcancou.
    while (out.length && out[out.length - 1] === null) out.pop();
    byMinute[METRICS[m][0]] = out;
  }
  let wins = 0;
  for (const i of rowIdx) wins += rows[i].win;
  return { sampleSize: rowIdx.length, sufficient: rowIdx.length >= MIN_CELL, winRate: round((100 * wins) / rowIdx.length), byMinute };
}

(() => {
  const files = [...listGz(path.join(DATA_DIR, 'pairs')), ...listGz(path.join(DATA_DIR, 'matches'))];
  if (!files.length) {
    console.log('nada em .gabarito/pairs nem em .gabarito/matches. Rode scripts/collect-pairs.cjs antes.');
    process.exit(1);
  }

  /** patch -> { matches, rows: [{ data: Int32Array, win }], l1: Map(celula -> indices), l2: Map } */
  const patches = {};
  let unreadable = 0;
  for (const file of files) {
    let od;
    try {
      od = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf-8')).od;
    } catch {
      unreadable++;
      continue;
    }
    const patch = PATCH_BY_OD_ID[od?.patch];
    if (!patch || !Array.isArray(od.players)) continue;
    const P = (patches[patch] ||= { matches: 0, rows: [], l1: new Map(), l2: new Map() });
    P.matches++;
    for (const p of od.players) {
      const pos = p.position_est;
      if (!(pos >= 1 && pos <= 5) || !p.hero_id) continue;
      const data = new Int32Array(METRICS.length * SLOTS).fill(MISSING);
      for (let m = 0; m < METRICS.length; m++) {
        const arr = p[METRICS[m][1]];
        if (!Array.isArray(arr)) continue;
        for (let t = 0; t < SLOTS && t < arr.length; t++) {
          if (typeof arr[t] === 'number' && arr[t] >= 0) data[m * SLOTS + t] = Math.round(arr[t]);
        }
      }
      const idx = P.rows.push({ data, win: p.win === 1 ? 1 : 0 }) - 1;
      const k1 = `${p.hero_id}:${pos}`;
      const k2 = `${p.hero_id}:${pos <= 3 ? 'core' : 'support'}`;
      (P.l1.get(k1) || P.l1.set(k1, []).get(k1)).push(idx);
      (P.l2.get(k2) || P.l2.set(k2, []).get(k2)).push(idx);
    }
  }

  const showArg = process.argv.indexOf('--show');
  const show = showArg > -1 ? process.argv[showArg + 1] : null;
  console.log(`BENCHMARKS PROPRIOS — ${files.length} arquivos${unreadable ? ` | ilegiveis ${unreadable}` : ''} | piso para valer no app: ${MIN_CELL} linhas | piso para sair no arquivo: ${MIN_EMIT}`);

  for (const patch of Object.keys(patches).sort()) {
    const P = patches[patch];
    const level = (map) => {
      const out = {};
      for (const [key, idx] of map) if (idx.length >= MIN_EMIT) out[key] = summarize(P.rows, idx);
      return out;
    };
    const heroPosition = level(P.l1);
    const heroRole = level(P.l2);
    const doc = {
      _note: 'Regua interna derivada (docs/PLANO-OPENDOTA.md, Fase 2). Regravado a cada execucao de scripts/build-benchmarks.cjs. Series cumulativas por minuto; n por minuto conta so quem ainda estava em jogo. So celula com sufficient=true pode virar benchmark no app.',
      patch,
      source: 'OpenDota /matches, partidas ranqueadas All Pick parseadas',
      builtAt: new Date().toISOString(),
      matches: P.matches,
      playerRows: P.rows.length,
      minCell: MIN_CELL,
      minEmit: MIN_EMIT,
      metrics: METRICS.map(([name]) => name),
      heroPosition,
      heroRole,
    };
    const file = path.join(DATA_DIR, 'benchmarks', `${patch}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(doc));
    const suff = (o) => Object.values(o).filter((c) => c.sufficient).length;
    console.log(`\nPATCH ${patch} — partidas ${P.matches} | linhas ${P.rows.length} | gravado em ${path.relative(process.cwd(), file)} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
    console.log(`  heroi x posicao:     ${Object.keys(heroPosition).length} celulas no arquivo (${MIN_EMIT}+ linhas) | ${suff(heroPosition)} com ${MIN_CELL}+ | de ${P.l1.size} vistas`);
    console.log(`  heroi x core/suporte: ${Object.keys(heroRole).length} celulas no arquivo | ${suff(heroRole)} com ${MIN_CELL}+ | de ${P.l2.size} vistas`);
    const cell = show ? heroPosition[show] || heroRole[show] : null;
    if (show && !cell) console.log(`  celula ${show}: fora do arquivo (menos de ${MIN_EMIT} linhas).`);
    if (cell) {
      console.log(`  celula ${show}: ${cell.sampleSize} linhas${cell.sufficient ? '' : ' — ABAIXO do piso, so acompanhamento'} | vitoria ${cell.winRate}%`);
      for (const t of [10, 20, 30]) {
        const nw = cell.byMinute.networth[t];
        const cs = cell.byMinute.lastHits[t];
        if (nw && cs) console.log(`    min ${t} (n ${nw.n}): patrimonio p25/p50/p75 ${nw.p25} / ${nw.p50} / ${nw.p75} | cs ${cs.p25} / ${cs.p50} / ${cs.p75}`);
      }
    }
  }
})();
