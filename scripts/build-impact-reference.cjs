/**
 * Referencia de contribuicao da regua propria do Glint (docs/PROPOSTA-REGUA-GLINT.md, §4):
 * ajusta o modelo de probabilidade de vitoria, VALIDA o modelo sozinho e mede a atribuicao.
 * A regua so serve se passar na propria validacao — este script existe para dizer isso antes
 * de qualquer nota ser medida contra ela.
 *
 *   node scripts/build-impact-reference.cjs     ajusta, valida e grava .gabarito/impact/wp-model.json
 *
 * Ajuste nas partidas de 7.41, validacao nas de 7.42 (divisao por partida, como o §5 do
 * plano). O arquivo gravado é DERIVADO: regravado a cada execucao; a fonte de verdade sao as
 * partidas em disco. Totalmente offline, sem token. Rodar da raiz. Hipoteses e limites da
 * atribuicao no cabecalho de `lib/impact.cjs`.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { fitLogistic, wpRows, wpSeries, attributable, attribute, sigmoid, dot } = require('./lib/impact.cjs');

const ROOT = path.join(process.cwd(), '.gabarito');
const OUT_DIR = path.join(ROOT, 'impact');
const PATCH_BY_OD_ID = { 60: '7.41', 61: '7.42' };
const TRAIN = '7.41';
const TEST = '7.42';
/** Minutos em que a validacao abre a acuracia: o modelo tem de ganhar informacao com o tempo. */
const CHECK_MINUTES = [5, 10, 20, 30];

function loadAll() {
  const out = [];
  for (const dir of ['pairs', 'matches']) {
    let names = [];
    try {
      names = fs.readdirSync(path.join(ROOT, dir)).filter((n) => n.endsWith('.json.gz'));
    } catch {
      continue;
    }
    for (const n of names) {
      try {
        const p = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, dir, n))).toString('utf-8'));
        if (p.od && PATCH_BY_OD_ID[p.od.patch]) out.push({ od: p.od, st: p.st || null, patch: PATCH_BY_OD_ID[p.od.patch] });
      } catch {
        // arquivo truncado: fora
      }
    }
  }
  return out;
}

const logLoss = (rows, w) => -rows.reduce((s, r) => { const p = Math.min(1 - 1e-9, Math.max(1e-9, sigmoid(dot(w, r.f)))); return s + (r.y ? Math.log(p) : Math.log(1 - p)); }, 0) / rows.length;
const brier = (rows, w) => rows.reduce((s, r) => s + (sigmoid(dot(w, r.f)) - r.y) ** 2, 0) / rows.length;

function corr(x, y) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let a = 0, b = 0, c = 0;
  for (let i = 0; i < n; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; }
  return a / Math.sqrt(b * c);
}

(() => {
  const all = loadAll();
  const train = all.filter((m) => m.patch === TRAIN);
  const test = all.filter((m) => m.patch === TEST);
  if (train.length < 200 || test.length < 100) {
    console.log(`partidas insuficientes: ${TRAIN} ${train.length}, ${TEST} ${test.length}.`);
    process.exit(1);
  }

  // ---- 1. Modelo de probabilidade de vitoria
  const trRows = wpRows(train.map((m) => m.od));
  const teRows = wpRows(test.map((m) => m.od));
  const w = fitLogistic(trRows);
  // Linha de base: so a vantagem de ouro, peso constante no tempo. O modelo tem de bater.
  const goldOnly = fitLogistic(trRows.map((r) => ({ f: [1, r.f[1]], y: r.y })));
  const teGold = teRows.map((r) => ({ f: [1, r.f[1]], y: r.y }));
  const base = teRows.reduce((s, r) => s + r.y, 0) / teRows.length;
  const constLoss = -(base * Math.log(base) + (1 - base) * Math.log(1 - base));

  console.log(`REFERENCIA DE CONTRIBUICAO — ajuste ${train.length} partidas de ${TRAIN} (${trRows.length} minutos) | validacao ${test.length} de ${TEST} (${teRows.length} minutos)`);
  console.log('\n1. PROBABILIDADE DE VITORIA (validacao, partidas fora do ajuste)');
  console.log(`  log loss ${logLoss(teRows, w).toFixed(4)} | so ouro, peso fixo ${logLoss(teGold, goldOnly).toFixed(4)} | constante ${constLoss.toFixed(4)}`);
  console.log(`  Brier    ${brier(teRows, w).toFixed(4)} | so ouro, peso fixo ${brier(teGold, goldOnly).toFixed(4)}`);
  const acc = CHECK_MINUTES.map((t) => {
    const rs = teRows.filter((r) => r.minute === t);
    const ok = rs.filter((r) => (sigmoid(dot(w, r.f)) >= 0.5) === (r.y === 1)).length;
    return `min ${t}: ${(100 * ok / rs.length).toFixed(0)}% (n ${rs.length})`;
  });
  console.log(`  acerto do lado vencedor por minuto: ${acc.join(' | ')}`);
  console.log('  calibracao por decil de probabilidade prevista (prevista -> observada, n):');
  const dec = Array.from({ length: 10 }, () => ({ p: 0, y: 0, n: 0 }));
  for (const r of teRows) {
    const p = sigmoid(dot(w, r.f));
    const d = dec[Math.min(9, Math.floor(p * 10))];
    d.p += p; d.y += r.y; d.n++;
  }
  let worst = 0;
  const cal = dec.filter((d) => d.n >= 30).map((d) => {
    const gap = Math.abs(d.p / d.n - d.y / d.n);
    worst = Math.max(worst, gap);
    return `${(d.p / d.n).toFixed(2)}->${(d.y / d.n).toFixed(2)} (${d.n})`;
  });
  console.log('    ' + cal.join('  '));
  console.log(`  maior desvio de calibracao entre decis com 30+ minutos: ${(100 * worst).toFixed(1)} pontos`);

  // ---- 2. Atribuicao, sobre todas as partidas atribuiveis
  const rows = [];
  let totalAbs = 0, fightAbs = 0, linRes = 0, nonFightAbs = 0, teamSumErr = 0, nMatches = 0;
  for (const m of all) {
    if (!attributable(m.od)) continue;
    const { contrib, diag } = attribute(w, m.od);
    nMatches++;
    totalAbs += diag.totalAbs;
    fightAbs += diag.fightAbs;
    linRes += diag.linResidualAbs;
    nonFightAbs += Math.max(0, diag.totalAbs - diag.fightAbs);
    const P = wpSeries(w, m.od).slice(0, diag.minutes);
    const radSum = m.od.players.reduce((s, p, i) => s + (p.isRadiant ? contrib[i] : 0), 0);
    teamSumErr += Math.abs(radSum - (P[P.length - 1] - P[0]));
    const st = new Map((m.st?.players || []).map((x) => [x.playerSlot, x]));
    m.od.players.forEach((p, i) => {
      const s = st.get(p.player_slot);
      rows.push({
        patch: m.patch,
        match: m.od.match_id, radiant: p.isRadiant, win: !!p.win, pos: p.position_est >= 1 && p.position_est <= 5 ? p.position_est : null,
        c: contrib[i], imp: s && typeof s.imp === 'number' ? s.imp : null,
        kda: ['kills_per_min', 'deaths_per_min', 'assists_per_min'].map((k) => p.benchmarks?.[k]?.pct),
        gpm: p.benchmarks?.gold_per_min?.pct,
      });
    });
  }
  console.log(`\n2. ATRIBUICAO — ${nMatches} partidas, ${rows.length} linhas de jogador`);
  console.log(`  variacao total de probabilidade que caiu em luta: ${(100 * fightAbs / totalAbs).toFixed(0)}% | fora de luta: ${(100 * nonFightAbs / totalAbs).toFixed(0)}%`);
  console.log(`  residuo da linearizacao fora de luta: ${(100 * linRes / nonFightAbs).toFixed(1)}% da variacao fora de luta`);
  console.log(`  soma da Radiant x variacao da probabilidade dela (min 0 ao ultimo): erro medio ${(teamSumErr / nMatches).toFixed(4)} por partida`);
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  // Media por posicao SO do ajuste: é a constante que o measure-glint.cjs desconta para
  // comparar jogadores de funcoes diferentes dentro do time, e nao pode vir do conjunto medido.
  const posMean = {};
  for (const p of [1, 2, 3, 4, 5]) {
    const cs = rows.filter((r) => r.pos === p && r.patch === TRAIN).map((r) => r.c);
    posMean[p] = cs.reduce((a, b) => a + b, 0) / cs.length;
  }
  console.log(`  mediana da contribuicao por posicao 1..5: ${[1, 2, 3, 4, 5].map((p) => med(rows.filter((r) => r.pos === p).map((r) => r.c)).toFixed(3)).join(' ')}`);
  console.log(`  vencedores ${med(rows.filter((r) => r.win).map((r) => r.c)).toFixed(3)} | perdedores ${med(rows.filter((r) => !r.win).map((r) => r.c)).toFixed(3)} (mediana)`);

  // Quanto a referencia se parece com as ENTRADAS do Glint: se for ~1, a regua mede a si mesma.
  const adj = rows.filter((r) => r.pos && r.kda.every((v) => typeof v === 'number') && typeof r.gpm === 'number');
  const cAdj = adj.map((r) => r.c - posMean[r.pos]);
  console.log(`  correlacao da contribuicao (descontada a media da posicao) com: media de 3 percentis (abates, mortes, assist.) ${corr(cAdj, adj.map((r) => (r.kda[0] + r.kda[1] + r.kda[2]) / 3)).toFixed(2)} | percentil de ouro/min ${corr(cAdj, adj.map((r) => r.gpm)).toFixed(2)}`);
  const withImp = rows.filter((r) => r.imp !== null);
  if (withImp.length > 1000) console.log(`  correlacao com o IMP (sanidade, ${withImp.length} linhas): ${corr(withImp.map((r) => r.c), withImp.map((r) => r.imp)).toFixed(2)}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const model = {
    builtAt: new Date().toISOString(),
    trainPatch: TRAIN,
    trainMatches: train.length,
    features: '[1, g, g*tau, g*tau^2, x, x*tau, x*tau^2]; g, x = vantagem da Radiant em milhares; tau = min(minuto, 60)/30',
    weights: w.map((v) => Number(v.toPrecision(6))),
    positionMean: posMean,
    validation: { patch: TEST, matches: test.length, logLoss: logLoss(teRows, w), brier: brier(teRows, w), worstDecileGap: worst },
  };
  fs.writeFileSync(path.join(OUT_DIR, 'wp-model.json'), JSON.stringify(model, null, 2));
  console.log(`\nmodelo gravado em .gabarito/impact/wp-model.json (derivado, regravado a cada execucao)`);
})();
