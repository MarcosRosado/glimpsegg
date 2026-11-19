/**
 * Ajuste do GLINT EXPERIMENTAL — a nota de impacto propria enquanto os benchmarks da Fase 2
 * nao existem (docs/PLANO-OPENDOTA.md, Fase 4). Gera os pesos que vivem em
 * `src/utils/glint.ts` e as metricas de teste que aparecem no tooltip da nota.
 *
 *   node scripts/fit-glint-experimental.cjs          metricas, pesos e tabela de limiares
 *   node scripts/fit-glint-experimental.cjs --json   so o bloco de pesos, para colar em glint.ts
 *
 * O MODELO. Regressao linear sobre os PERCENTIS que a OpenDota calcula por jogador
 * (`players[].benchmarks[].pct`: percentil daquela estatistica entre partidas do MESMO HEROI,
 * partida inteira, todos os ranques). O alvo é o IMP da STRATZ + 50, na mesma partida. Ou
 * seja: é uma imitacao do IMP feita com oito percentis, NAO a nota do plano (que compara por
 * minuto, por posicao, contra benchmark proprio). Por isso o rotulo "experimental".
 *
 * PROTOCOLO (§5 do plano). Ajuste nas partidas de 7.41, teste nas de 7.42, divisao por
 * partida. Dois conjuntos de pesos por papel (core = posicao 1 a 3, suporte = 4 e 5) e um
 * sem papel, para partida nao parseada, que nao tem `position_est`.
 *
 * O QUE FICOU DE FORA, medido em 2026-11-19 sobre ~500 partidas:
 *  - `hero_healing_per_min` e `tower_damage`: o percentil que vem na partida nao bate com o
 *    interpolado da tabela publica (`/benchmarks`) quando o valor é 0 — e a lista de partidas
 *    so tem a tabela. Tirar os dois nao muda o teste (r 0,82 com ou sem).
 *  - Vitoria como variavel: nao melhora o teste e amarraria a nota ao resultado.
 * Declarado: a escolha entre as variantes foi feita OLHANDO o conjunto de teste. As metricas
 * abaixo sao, por isso, um pouco otimistas; a proxima medida limpa é em partidas novas.
 *
 * `deaths_per_min.pct` ja vem invertido da OpenDota (menos morte = percentil maior).
 *
 * Totalmente offline: le `.gabarito/pairs/`. Rodar da raiz.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIR = path.join(process.cwd(), '.gabarito', 'pairs');
const METRICS = ['gold_per_min', 'xp_per_min', 'kills_per_min', 'deaths_per_min', 'assists_per_min', 'last_hits_per_min', 'denies_per_min', 'hero_damage_per_min'];
const TRAIN_PATCH = 60;
const TEST_PATCH = 61;
/** Limiares de IMP espalhados pelo app; a tabela diz que Glint dispara na MESMA taxa. */
const IMP_THRESHOLDS = [-50, -25, -10, 0, 5, 15, 25, 30, 35, 50];

function solve(A, b) {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
    [M[i], M[p]] = [M[p], M[i]];
    for (let j = i + 1; j < n; j++) {
      const f = M[j][i] / M[i][i];
      for (let k = i; k <= n; k++) M[j][k] -= f * M[i][k];
    }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

/** Minimos quadrados: [intercepto, ...um peso por metrica]. */
function fit(rows) {
  const n = METRICS.length + 1;
  const A = Array.from({ length: n }, () => Array(n).fill(0));
  const b = Array(n).fill(0);
  for (const r of rows) {
    const f = [1, ...r.x];
    for (let i = 0; i < n; i++) {
      b[i] += f[i] * r.y;
      for (let j = 0; j < n; j++) A[i][j] += f[i] * f[j];
    }
  }
  for (let i = 0; i < n; i++) A[i][i] += 1e-6;
  return solve(A, b);
}

const clamp = (v) => Math.max(0, Math.min(100, v));
const predict = (w, r) => Math.round(clamp(w[0] + r.x.reduce((s, v, i) => s + v * w[i + 1], 0)));

function corr(x, y) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sx += (x[i] - mx) ** 2;
    sy += (y[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sx * sy);
}

function evaluate(matches, pred) {
  const flat = matches.flat();
  const x = flat.map(pred);
  const y = flat.map((r) => r.y);
  let best = 0;
  for (const m of matches) {
    const g = m.map(pred);
    const t = m.map((r) => r.y);
    if (g.indexOf(Math.max(...g)) === t.indexOf(Math.max(...t))) best++;
  }
  return {
    players: x.length,
    matches: matches.length,
    r: Number(corr(x, y).toFixed(2)),
    meanAbsError: Number((x.reduce((s, v, i) => s + Math.abs(v - y[i]), 0) / x.length).toFixed(1)),
    sameSidePct: Math.round((100 * x.filter((v, i) => (v >= 50) === (y[i] >= 50)).length) / x.length),
    sameBestPct: Math.round((100 * best) / matches.length),
  };
}

(() => {
  let files = [];
  try {
    files = fs.readdirSync(DIR).filter((n) => n.endsWith('.json.gz'));
  } catch {
    // tratado abaixo
  }
  const matches = [];
  for (const name of files) {
    let p;
    try {
      p = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, name))).toString('utf-8'));
    } catch {
      continue;
    }
    const st = new Map((p.st?.players || []).map((x) => [x.playerSlot, x]));
    const rows = [];
    for (const o of p.od?.players || []) {
      const s = st.get(o.player_slot);
      const x = METRICS.map((k) => o.benchmarks?.[k]?.pct);
      if (!s || typeof s.imp !== 'number' || x.some((v) => typeof v !== 'number')) continue;
      rows.push({ x, y: s.imp + 50, core: o.position_est >= 1 && o.position_est <= 3, hasRole: o.position_est >= 1 && o.position_est <= 5, patch: p.od.patch });
    }
    // So partida com os dez jogadores rotulados: "melhor da partida" precisa dos dez.
    if (rows.length === 10) matches.push(rows);
  }
  const train = matches.filter((m) => m[0].patch === TRAIN_PATCH);
  const test = matches.filter((m) => m[0].patch === TEST_PATCH);
  if (train.length < 50 || test.length < 50) {
    console.log(`pares insuficientes: treino (7.41) ${train.length}, teste (7.42) ${test.length}. Rode scripts/collect-pairs.cjs.`);
    process.exit(1);
  }

  const tr = train.flat();
  const weights = {
    core: fit(tr.filter((r) => r.hasRole && r.core)),
    support: fit(tr.filter((r) => r.hasRole && !r.core)),
    any: fit(tr),
  };
  const byRole = (r) => predict(r.hasRole ? (r.core ? weights.core : weights.support) : weights.any, r);
  const noRole = (r) => predict(weights.any, r);
  const metrics = { byRole: evaluate(test, byRole), noRole: evaluate(test, noRole) };
  const block = {
    fittedAt: new Date().toISOString().slice(0, 10),
    trainPatch: '7.41',
    trainMatches: train.length,
    testPatch: '7.42',
    testMatches: test.length,
    metrics: METRICS,
    weights: Object.fromEntries(Object.entries(weights).map(([k, w]) => [k, w.map((v) => Number(v.toFixed(2)))])),
    test: metrics,
  };
  if (process.argv.includes('--json')) return console.log(JSON.stringify(block, null, 2));

  console.log(`GLINT EXPERIMENTAL — treino ${train.length} partidas de 7.41 | teste ${test.length} partidas de 7.42`);
  const line = (name, m) => console.log(`  ${name.padEnd(28)} r ${m.r} | erro medio ${m.meanAbsError} | mesmo lado do 50: ${m.sameSidePct}% | mesmo melhor da partida: ${m.sameBestPct}%`);
  line('por papel (partida parseada)', metrics.byRole);
  line('sem papel (nao parseada)', metrics.noRole);
  console.log('  aceite da Fase 4 (nota definitiva): r >= 0,85 | erro <= 9 | lado >= 88% | melhor >= 60%  => NAO atingido: fica "experimental".');
  console.log('  linha de base do plano (calculateCustomImp): r 0,68 | erro 16 | lado 76% | melhor 5/13');

  console.log('\nLIMIARES — a regressao comprime a escala, entao NAO se converte limiar somando 50.');
  console.log('  Para cada limiar de IMP: taxa de disparo no teste e o Glint que dispara na mesma taxa.');
  const flat = test.flat();
  for (const [label, pred] of [['por papel', byRole], ['sem papel', noRole]]) {
    const g = flat.map(pred).sort((a, b) => a - b);
    const imp = flat.map((r) => r.y - 50);
    console.log(`  ${label}: Glint p10/p50/p90 = ${g[Math.floor(g.length * 0.1)]} / ${g[g.length >> 1]} / ${g[Math.floor(g.length * 0.9)]}`);
    for (const t of IMP_THRESHOLDS) {
      const high = t >= 0;
      const rate = imp.filter((v) => (high ? v >= t : v <= t)).length / imp.length;
      // Mesmo quantil do outro lado: os `rate` maiores (ou menores) valores de Glint.
      const k = Math.round(rate * g.length);
      const eq = k === 0 ? null : high ? g[g.length - k] : g[k - 1];
      console.log(`    IMP ${high ? '>=' : '<='} ${String(t).padStart(3)}: ${(100 * rate).toFixed(1).padStart(5)}% das linhas  =>  Glint ${eq === null ? 'nunca dispara' : (high ? '>= ' : '<= ') + eq}`);
    }
  }
  console.log('\npesos (intercepto, depois ' + METRICS.join(', ') + '):');
  for (const [k, w] of Object.entries(block.weights)) console.log(`  ${k.padEnd(8)} ${w.join('  ')}`);
  console.log('\npara colar em src/utils/glint.ts: node scripts/fit-glint-experimental.cjs --json');
})();
