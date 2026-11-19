/**
 * Criterio de corte CONTINUO da Fase 2 de docs/PLANO-OPENDOTA.md: quanto do que ja foi
 * colhido sustenta um benchmark proprio, e quao perto a curva propria fica da fotografia
 * da STRATZ. Roda quando quiser, sobre o que estiver em disco. Roteiro: docs/COLETA-GABARITO.md.
 *
 *   node scripts/benchmark-coverage.cjs            relatorio + uma linha no historico
 *   node scripts/benchmark-coverage.cjs --no-log   so o relatorio
 *   node scripts/benchmark-coverage.cjs --history  so o historico ja gravado
 *   node scripts/benchmark-coverage.cjs --min-cell 30   explora com piso menor (nao grava historico)
 *
 * Le a metade OpenDota de `.gabarito/pairs/` e tudo de `.gabarito/matches/` (o volume
 * so-OpenDota de `collect-pairs.cjs`). Unidade: LINHA DE JOGADOR com `position_est`.
 *
 * 1. COBERTURA — o criterio de corte. Para cada patch: que fatia das linhas cai em celula
 *    de nivel 1 (heroi x posicao) com pelo menos `MIN_CELL` linhas, e que fatia so se salva
 *    no nivel 2 (heroi x core/suporte). O plano pedia 60% em 14 dias; virou medida continua
 *    (decisao de 2026-11-19): cada execucao grava uma linha em `.gabarito/coverage-log.jsonl`
 *    e a pergunta passa a ser "a curva esta subindo no ritmo que da para manter?".
 *    Vies declarado: a amostra é a propria base (cada linha conta para a celula em que cai),
 *    e os pares sao estratificados por ranque e duracao, nao sorteados.
 *
 * 2. CURVA PROPRIA x FOTOGRAFIA — previa do aceite da Fase 2. Nas celulas com amostra
 *    propria suficiente, a media de patrimonio e de cs nos minutos 10, 20 e 30 contra
 *    `heroStats.stats` da STRATZ, com a fotografia REPONDERADA pela mistura de faixas de
 *    ranque da nossa amostra (a nossa é estratificada; comparar com a media geral da STRATZ
 *    mediria a diferenca de mistura, nao a de curva). O indice de tempo das duas fontes pode
 *    nao ser o mesmo minuto, entao o erro sai nos DOIS alinhamentos e o relatorio diz qual
 *    encaixa — nada é assumido. A fotografia é de uma semana de 7.41: so compara com 7.41.
 *
 * Totalmente offline: nao le token, nao toca a rede. Rodar da raiz.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DATA_DIR = path.join(process.cwd(), '.gabarito');
/**
 * Piso de linhas por celula do desenho hierarquico do plano (Fase 0, "200 por celula").
 * `--min-cell N` troca o piso para EXPLORAR (ver cedo para que lado a curva vai); com piso
 * diferente do padrao a execucao nao entra no historico, para a serie nao misturar reguas.
 */
const minCellArg = process.argv.indexOf('--min-cell');
const MIN_CELL = minCellArg > -1 && Number(process.argv[minCellArg + 1]) > 0 ? Number(process.argv[minCellArg + 1]) : 200;
const DEFAULT_MIN_CELL = MIN_CELL === 200;
/** Piso do aceite da Fase 2: so compara onde a fotografia tem mais de 5.000 partidas. */
const SNAPSHOT_MIN_MATCHES = 5000;
const ACCEPT_ERROR = 0.05;
const MINUTES = [10, 20, 30];
const PATCH_BY_OD_ID = { 60: '7.41', 61: '7.42' };
const SNAPSHOT_PATCH = '7.41';
const HERO_COUNT = 127;
const BRACKETS = [
  ['HERALD_GUARDIAN', 10, 30],
  ['CRUSADER_ARCHON', 30, 50],
  ['LEGEND_ANCIENT', 50, 70],
  ['DIVINE_IMMORTAL', 70, 90],
];
const bracketOf = (rankTier) => BRACKETS.find(([, lo, hi]) => rankTier >= lo && rankTier < hi)?.[0] ?? null;
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : 'n/d');

function listGz(dir) {
  try {
    return fs.readdirSync(dir).filter((n) => n.endsWith('.json.gz')).map((n) => path.join(dir, n));
  } catch {
    return [];
  }
}

function latestSnapshotDir() {
  try {
    const root = path.join(DATA_DIR, 'hero-stats');
    const days = fs.readdirSync(root).filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
    return days.length ? path.join(root, days[days.length - 1]) : null;
  } catch {
    return null;
  }
}

function printHistory(logPath) {
  let lines = [];
  try {
    lines = fs.readFileSync(logPath, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch {
    // sem historico ainda
  }
  if (!lines.length) return console.log('historico vazio.');
  console.log('\nHISTORICO (.gabarito/coverage-log.jsonl)');
  console.log('quando'.padEnd(18) + 'patch'.padEnd(7) + 'partidas'.padStart(9) + 'linhas'.padStart(9) + 'nivel 1'.padStart(9) + 'niv 1+2'.padStart(9) + 'cel>=' + MIN_CELL);
  for (const l of lines) {
    for (const [patch, p] of Object.entries(l.patches)) {
      console.log(l.at.slice(0, 16).padEnd(18) + patch.padEnd(7) + String(p.matches).padStart(9) + String(p.rows).padStart(9) + pct(p.rowsL1, p.rows).padStart(9) + pct(p.rowsL1 + p.rowsL2, p.rows).padStart(9) + `   ${p.cellsL1}/${HERO_COUNT * 5}`);
    }
  }
}

(() => {
  const logPath = path.join(DATA_DIR, 'coverage-log.jsonl');
  if (process.argv.includes('--history')) return printHistory(logPath);

  const files = [...listGz(path.join(DATA_DIR, 'pairs')), ...listGz(path.join(DATA_DIR, 'matches'))];
  if (!files.length) {
    console.log('nada em .gabarito/pairs nem em .gabarito/matches. Rode scripts/collect-pairs.cjs antes.');
    process.exit(1);
  }

  /** patch -> { matches, rows, noPosition, l1: Map, l2: Map, byDay: {} } */
  const patches = {};
  /** So para o patch da fotografia: celula `hero:pos` -> { n, brackets: {b: n}, sums: {min: {nw, cs, n}} } */
  const curves = new Map();
  let unreadable = 0;
  let unknownPatch = 0;

  for (const file of files) {
    let od;
    try {
      od = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf-8')).od;
    } catch {
      unreadable++;
      continue;
    }
    const patch = PATCH_BY_OD_ID[od?.patch];
    if (!patch || !Array.isArray(od.players)) { unknownPatch++; continue; }
    const P = (patches[patch] ||= { matches: 0, rows: 0, noPosition: 0, l1: new Map(), l2: new Map(), byDay: {} });
    P.matches++;
    const day = fs.statSync(file).mtime.toISOString().slice(0, 10);
    P.byDay[day] = (P.byDay[day] || 0) + 1;
    for (const p of od.players) {
      const pos = p.position_est;
      if (!(pos >= 1 && pos <= 5) || !p.hero_id) { P.noPosition++; continue; }
      P.rows++;
      const k1 = `${p.hero_id}:${pos}`;
      const k2 = `${p.hero_id}:${pos <= 3 ? 'core' : 'support'}`;
      P.l1.set(k1, (P.l1.get(k1) || 0) + 1);
      P.l2.set(k2, (P.l2.get(k2) || 0) + 1);
      if (patch !== SNAPSHOT_PATCH) continue;
      const b = bracketOf(p.rank_tier);
      // Sem medalha nao da para reponderar a fotografia: a linha fica fora da comparacao.
      if (!b || !Array.isArray(p.networth_t) || !Array.isArray(p.lh_t)) continue;
      const c = curves.get(k1) || { n: 0, brackets: {}, at: {} };
      curves.set(k1, c);
      c.n++;
      c.brackets[b] = (c.brackets[b] || 0) + 1;
      // Guarda os dois alinhamentos de minuto (t e t-1) e a mistura de faixas de quem
      // CHEGOU a cada minuto — a fotografia tambem so conta quem chegou.
      for (const m of MINUTES) {
        for (const shift of [0, -1]) {
          const i = m + shift;
          if (typeof p.networth_t[i] !== 'number' || typeof p.lh_t[i] !== 'number') continue;
          const a = (c.at[`${m}:${shift}`] ||= { n: 0, nw: 0, cs: 0, brackets: {} });
          a.n++;
          a.nw += p.networth_t[i];
          a.cs += p.lh_t[i];
          a.brackets[b] = (a.brackets[b] || 0) + 1;
        }
      }
    }
  }

  console.log(`BASE PROPRIA — ${files.length} arquivos${unreadable ? ` | ilegiveis ${unreadable}` : ''}${unknownPatch ? ` | patch desconhecido ${unknownPatch}` : ''} | piso por celula: ${MIN_CELL} linhas`);
  const logEntry = { at: new Date().toISOString(), minCell: MIN_CELL, patches: {} };
  for (const patch of Object.keys(patches).sort()) {
    const P = patches[patch];
    let rowsL1 = 0;
    let rowsL2 = 0;
    for (const [k1, n] of P.l1) {
      if (n >= MIN_CELL) { rowsL1 += n; continue; }
      const [hero, pos] = k1.split(':');
      if ((P.l2.get(`${hero}:${Number(pos) <= 3 ? 'core' : 'support'}`) || 0) >= MIN_CELL) rowsL2 += n;
    }
    const cellsL1 = [...P.l1.values()].filter((n) => n >= MIN_CELL).length;
    const cellsL2 = [...P.l2.values()].filter((n) => n >= MIN_CELL).length;
    const sizes = [...P.l1.values()].sort((a, b) => b - a);
    console.log(`\nPATCH ${patch} — partidas ${P.matches} | linhas de jogador ${P.rows}${P.noPosition ? ` (sem position_est: ${P.noPosition})` : ''}`);
    console.log(`  CRITERIO DE CORTE: nivel 1 ${pct(rowsL1, P.rows)} | nivel 1 ou 2 ${pct(rowsL1 + rowsL2, P.rows)} (referencia do plano: 60%)`);
    console.log(`  celulas com amostra: heroi x posicao ${cellsL1}/${HERO_COUNT * 5} | heroi x core/suporte ${cellsL2}/${HERO_COUNT * 2} | celulas vistas ${P.l1.size} | maior ${sizes[0] || 0} | mediana ${sizes[Math.floor(sizes.length / 2)] || 0}`);
    console.log(`  partidas por dia de coleta: ${Object.entries(P.byDay).sort().map(([d, n]) => `${d.slice(5)} ${n}`).join(' | ')}`);
    // Conta de bolso, uniforme (o plano ja avisa que a distribuicao real é desigual).
    console.log(`  para ${MIN_CELL} por celula se fosse uniforme: ${HERO_COUNT * 5 * MIN_CELL} linhas (nivel 1) — ha ${P.rows} (${pct(P.rows, HERO_COUNT * 5 * MIN_CELL)})`);
    logEntry.patches[patch] = { matches: P.matches, rows: P.rows, rowsL1, rowsL2, cellsL1, cellsL2 };
  }

  // --- curva propria x fotografia -------------------------------------------------------
  const snapDir = latestSnapshotDir();
  console.log(`\nCURVA PROPRIA x FOTOGRAFIA DA STRATZ (${SNAPSHOT_PATCH}, patrimonio e cs nos minutos ${MINUTES.join(', ')})`);
  if (!snapDir) console.log('  sem fotografia em .gabarito/hero-stats: rode scripts/snapshot-hero-stats.cjs.');
  else if (!patches[SNAPSHOT_PATCH]) console.log(`  nenhuma partida de ${SNAPSHOT_PATCH} na base propria ainda.`);
  else {
    const snapCache = new Map();
    const snapRows = (hero, bracket) => {
      const k = `${hero}:${bracket}`;
      if (!snapCache.has(k)) {
        let rows = [];
        try {
          rows = JSON.parse(fs.readFileSync(path.join(snapDir, `hero-${hero}-${bracket}.json`), 'utf-8'));
        } catch {
          // faixa sem arquivo: sem comparacao para ela
        }
        snapCache.set(k, rows);
      }
      return snapCache.get(k);
    };
    const eligible = [...curves].filter(([, c]) => c.n >= MIN_CELL);
    const result = { 0: { nw: [], cs: [] }, [-1]: { nw: [], cs: [] } };
    let comparedCells = 0;
    for (const [k1, c] of eligible) {
      const [hero, pos] = k1.split(':');
      let used = false;
      for (const m of MINUTES) {
        for (const shift of [0, -1]) {
          const a = c.at[`${m}:${shift}`];
          if (!a || a.n < MIN_CELL) continue;
          // Fotografia reponderada pela mistura de faixas de quem chegou a este minuto.
          let w = 0, nw = 0, cs = 0, ok = true;
          for (const [b, n] of Object.entries(a.brackets)) {
            const row = snapRows(hero, b).find((r) => r.position === `POSITION_${pos}` && r.time === m);
            if (!row || !(row.matchCount > SNAPSHOT_MIN_MATCHES)) { ok = false; break; }
            w += n;
            nw += n * row.networth;
            cs += n * row.cs;
          }
          if (!ok || !w) continue;
          used = true;
          result[shift].nw.push(Math.abs(a.nw / a.n - nw / w) / (nw / w));
          if (cs / w > 0) result[shift].cs.push(Math.abs(a.cs / a.n - cs / w) / (cs / w));
        }
      }
      if (used) comparedCells++;
    }
    console.log(`  celulas proprias com ${MIN_CELL}+ linhas: ${eligible.length} | comparaveis (fotografia > ${SNAPSHOT_MIN_MATCHES} partidas em toda faixa presente): ${comparedCells}`);
    if (!comparedCells) console.log('  ainda sem celula comparavel: é esperado com poucos dias de coleta.');
    else {
      const med = (v) => (v.length ? v.slice().sort((x, y) => x - y)[Math.floor(v.length / 2)] : null);
      const within = (v) => v.filter((e) => e < ACCEPT_ERROR).length;
      for (const shift of [0, -1]) {
        const r = result[shift];
        console.log(`  alinhamento ${shift === 0 ? 'minuto t da STRATZ = indice t da OpenDota  ' : 'minuto t da STRATZ = indice t-1 da OpenDota'}: patrimonio erro mediano ${med(r.nw) === null ? 'n/d' : (100 * med(r.nw)).toFixed(1) + '%'} (${within(r.nw)}/${r.nw.length} dentro de 5%) | cs erro mediano ${med(r.cs) === null ? 'n/d' : (100 * med(r.cs)).toFixed(1) + '%'} (${within(r.cs)}/${r.cs.length} dentro de 5%)`);
      }
      console.log('  aceite da Fase 2: erro < 5% nessas celulas. O alinhamento de menor erro é o que vale; o outro fica como controle.');
      logEntry.curve = { cells: comparedCells, shift0: { nw: med(result[0].nw), cs: med(result[0].cs) }, shiftMinus1: { nw: med(result[-1].nw), cs: med(result[-1].cs) } };
    }
  }

  if (!DEFAULT_MIN_CELL) console.log(`\npiso de exploracao (${MIN_CELL}): execucao fora do historico.`);
  else if (!process.argv.includes('--no-log')) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
    console.log('\nlinha gravada em .gabarito/coverage-log.jsonl (veja a serie com --history)');
  }
})();
