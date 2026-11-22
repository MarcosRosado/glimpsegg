/**
 * A REGUA PROPRIA DO GLINT (docs/PROPOSTA-REGUA-GLINT.md, §3): mede R1 a R9 para o Glint do
 * app e para as duas linhas de base que ele tem de bater. Nao ajusta nada; so mede.
 *
 *   node scripts/measure-glint.cjs              medida OFICIAL: 7.42 colhido depois do congelamento
 *   node scripts/measure-glint.cjs --explore    o que ja foi olhado (7.41 + 7.42), EXPLORATORIO
 *   ... --model <bloco.json>   mede um CANDIDATO (pesos de `fit-glint-experimental.cjs --target
 *                              contrib --json`) com a funcao do app, no lugar do GLINT_MODEL
 *   ... --seen a.json,b.json   listas congeladas (padrao: so .gabarito/glint-seen-2026-11-21.json).
 *                              O oficial exclui a UNIAO delas; o --explore le so a PRIMEIRA
 *
 * O CONJUNTO OFICIAL. `.gabarito/glint-seen-2026-11-21.json` lista as 2.573 partidas que ja
 * tinham sido olhadas quando a regua foi escrita (o 7.42 em que o Glint foi testado e onde a
 * proposta explorou; o 7.41 é o treino). A medida oficial usa so partidas de 7.42 que NAO
 * estao nessa lista. `--explore` existe para desenvolver o script, e a saida diz isso no topo:
 * numero de --explore nao decide nada. Desde 2026-11-22 ele le SO partidas da primeira lista
 * congelada: antes lia tudo em disco, inclusive o conjunto oficial, e olhar o oficial por ali
 * desfazia o congelamento.
 *
 * O REAJUSTE (passo 4 do roteiro do Glint no plano). A v5 treinou na lista de 2026-11-21 e
 * esta no app desde 2026-11-22 (decisao do dono, antes da medida). A medida dela é `--seen
 * .gabarito/glint-seen-2026-11-21.json,.gabarito/glint-seen-2026-11-22.json` (o GLINT_MODEL do
 * app; com `--model .gabarito/glint-candidate-2026-11-22-v5.json` a saida é identica): so 7.42
 * colhido depois do SEGUNDO congelamento, a partir de 500 partidas. O modelo antigo, ajustado ao
 * IMP, se mede com `--model .gabarito/glint-imp-fit-2026-11-19.json` (padrao de --seen). Mudou o
 * modelo do app depois disso? Terceiro congelamento antes de medir de novo.
 *
 * QUEM É MEDIDO.
 *  - `glint`: a funcao do app (`computeGlint`, carregada de src/utils/glint.ts pelo
 *    `runnerImport` do Vite — uma copia dos pesos aqui mediria outra nota), pesos por papel.
 *  - `glint-any`: a mesma, sem papel — é o que a lista de partidas mostra.
 *  - `kda3`: media dos percentis de abates, mortes e assistencias, x100.
 *  - `media8`: media dos oito percentis, x100.
 *  - `imp`: IMP + 50 da STRATZ, onde houver. So relatado (D8).
 *
 * R5 precisa da referencia de contribuicao: rode antes `node scripts/build-impact-reference.cjs`.
 * Offline, sem token. Rodar da raiz.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pathToFileURL } = require('url');
const { attributable, attribute } = require('./lib/impact.cjs');

const ROOT = path.join(process.cwd(), '.gabarito');
const argAfter = (flag) => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : undefined; };
const SEEN_FILES = argAfter('--seen') ? argAfter('--seen').split(',').map((f) => path.resolve(f)) : [path.join(ROOT, 'glint-seen-2026-11-21.json')];
const SEEN_FILE = SEEN_FILES[SEEN_FILES.length - 1];
const MODEL_ARG = argAfter('--model');
const MODEL_FILE = path.join(ROOT, 'impact', 'wp-model.json');
const OFFICIAL_PATCH = 61; // 7.42
const PATCH_NAME = { 60: '7.41', 61: '7.42' };
const MIN_OFFICIAL = 500;
const HERO_MIN_ROWS = 200;
const BOOT = 2000;
const PCT_KEYS = ['gold_per_min', 'xp_per_min', 'kills_per_min', 'deaths_per_min', 'assists_per_min', 'last_hits_per_min', 'denies_per_min', 'hero_damage_per_min'];

async function loadGlint() {
  const vite = await import(pathToFileURL(require.resolve('vite', { paths: [process.cwd()] })).href);
  const { module: mod } = await vite.runnerImport(path.resolve('src/utils/glint.ts'), { configFile: false, logLevel: 'error' });
  if (typeof mod.computeGlint !== 'function') throw new Error('glint.ts nao exporta computeGlint');
  return mod;
}

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const med = (a) => q(a, 0.5);
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
function corr(x, y) {
  const n = x.length, mx = mean(x), my = mean(y);
  let a = 0, b = 0, c = 0;
  for (let i = 0; i < n; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; }
  return b && c ? a / Math.sqrt(b * c) : NaN;
}
function ranks(a) {
  const s = a.map((v, i) => [v, i]).sort((p, r) => p[0] - r[0]);
  const out = Array(a.length);
  for (let i = 0; i < s.length;) {
    let j = i;
    while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++;
    for (let k = i; k <= j; k++) out[s[k][1]] = (i + j) / 2;
    i = j + 1;
  }
  return out;
}
const spearman = (x, y) => corr(ranks(x), ranks(y));
/** Indice do maximo; empate = nenhum (um "melhor" que o arredondamento decide nao conta). */
function argmaxStrict(a) {
  const m = Math.max(...a);
  const idx = a.flatMap((v, i) => (v === m ? [i] : []));
  return idx.length === 1 ? idx[0] : -1;
}
/**
 * IC95 por bootstrap da media de diferencas pareadas por time, reamostrando PARTIDAS (os dois
 * times de uma partida andam juntos: reamostrar times trataria como independentes dois lados
 * do mesmo jogo e estreitaria o intervalo). Semente fixa: a saida é reprodutivel.
 */
function bootCI(teams, diff) {
  const byMatch = new Map();
  for (const t of teams) (byMatch.get(t.id) || byMatch.set(t.id, []).get(t.id)).push(diff(t));
  const groups = [...byMatch.values()];
  let seed = 42;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const means = [];
  for (let b = 0; b < BOOT; b++) {
    let s = 0, n = 0;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[Math.floor(rnd() * groups.length)];
      for (const v of g) { s += v; n++; }
    }
    means.push(s / n);
  }
  return [q(means, 0.025), q(means, 0.975)];
}

(async () => {
  const explore = process.argv.includes('--explore');
  const seenLists = [];
  for (const f of SEEN_FILES) {
    try {
      seenLists.push(new Set(JSON.parse(fs.readFileSync(f, 'utf-8')).ids));
    } catch {
      console.log(`falta ${path.relative(process.cwd(), f)}: sem ele nao ha como separar o conjunto oficial.`);
      process.exit(1);
    }
  }
  const seen = new Set(seenLists.flatMap((l) => [...l]));
  const explored = seenLists[0];
  let model = null;
  try {
    model = JSON.parse(fs.readFileSync(MODEL_FILE, 'utf-8'));
  } catch {
    console.log('sem .gabarito/impact/wp-model.json: R5 fica sem medida. Rode scripts/build-impact-reference.cjs.');
  }
  const G = await loadGlint();
  // O modelo medido: o GLINT_MODEL do app ou, com --model, o candidato — sempre pela funcao do
  // app (`computeGlint` recebe o modelo), nunca por uma copia da formula.
  let MODEL = G.GLINT_MODEL;
  if (MODEL_ARG) {
    let cand;
    try { cand = JSON.parse(fs.readFileSync(path.resolve(MODEL_ARG), 'utf-8')); } catch { cand = null; }
    const ok = cand && ['core', 'support', 'any'].every((k) => Array.isArray(cand.weights?.[k]) && cand.weights[k].length === PCT_KEYS.length + 1);
    if (!ok || JSON.stringify(cand.metrics) !== JSON.stringify(PCT_KEYS)) {
      console.log(`--model ${MODEL_ARG}: bloco invalido (precisa de weights.core/support/any e das oito metricas na ordem do app).`);
      process.exit(1);
    }
    MODEL = cand;
  }

  const matches = [];
  for (const dir of ['pairs', 'matches']) {
    let names = [];
    try { names = fs.readdirSync(path.join(ROOT, dir)).filter((n) => n.endsWith('.json.gz')); } catch { continue; }
    for (const n of names) {
      const id = Number(n.replace('.json.gz', ''));
      if (explore ? !explored.has(id) : seen.has(id)) continue;
      let p;
      try { p = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, dir, n))).toString('utf-8')); } catch { continue; }
      const od = p.od;
      if (!od || !PATCH_NAME[od.patch] || (!explore && od.patch !== OFFICIAL_PATCH)) continue;
      if (!Array.isArray(od.players) || od.players.length !== 10) continue;
      const st = new Map((p.st?.players || []).map((x) => [x.playerSlot, x]));
      const ref = model && attributable(od) ? attribute(model.weights, od).contrib : null;
      const rows = [];
      for (let i = 0; i < 10; i++) {
        const o = od.players[i];
        const x = PCT_KEYS.map((k) => o.benchmarks?.[k]?.pct);
        if (x.some((v) => typeof v !== 'number')) break;
        const pos = o.position_est >= 1 && o.position_est <= 5 ? o.position_est : null;
        const pct = G.glintPercentilesFromMatch(o.benchmarks);
        const s = st.get(o.player_slot);
        rows.push({
          hero: o.hero_id, pos, win: !!o.win, radiant: !!o.isRadiant,
          ref: ref && pos ? ref[i] - model.positionMean[pos] : null,
          scores: {
            glint: G.computeGlint(pct, pos ? G.glintRoleOf(`POSITION_${pos}`) : null, od.duration, MODEL, o.hero_id),
            // A nota sem posicao, como a lista de partidas mostra (com `heroCoreShare`, se o
            // modelo tiver, a mistura core/suporte pela fatia do heroi).
            'glint-any': G.computeGlint(pct, null, od.duration, MODEL, o.hero_id),
            kda3: (100 * (x[2] + x[3] + x[4])) / 3,
            media8: (100 * x.reduce((a, b) => a + b, 0)) / 8,
            imp: s && typeof s.imp === 'number' ? s.imp + 50 : null,
          },
        });
      }
      if (rows.length === 10) matches.push({ id, duration: od.duration, rows });
    }
  }

  const frozenOn = (path.basename(SEEN_FILE).match(/\d{4}-\d{2}-\d{2}/) || ['?'])[0];
  const header = explore
    ? `REGUA DO GLINT — EXPLORATORIO (--explore: so partidas ja olhadas, de ${path.basename(SEEN_FILES[0])}; nao decide nada)`
    : `REGUA DO GLINT — MEDIDA OFICIAL (7.42 colhido depois de ${frozenOn}, fora de ${SEEN_FILES.map((f) => path.basename(f)).join(' + ')})`;
  console.log(header);
  if (MODEL_ARG) console.log(`modelo medido: CANDIDATO ${path.basename(MODEL_ARG)} (nao o GLINT_MODEL do app)`);
  console.log(`partidas ${matches.length} | linhas ${matches.length * 10}`);
  if (!explore && matches.length < MIN_OFFICIAL) {
    console.log(`conjunto oficial abaixo de ${MIN_OFFICIAL} partidas: ainda nao ha medida. A coleta diaria vai enchendo; rode de novo depois.`);
    process.exit(0);
  }

  const KEYS = ['glint', 'glint-any', 'kda3', 'media8', 'imp'];
  const res = {};
  for (const key of KEYS) {
    const ms = matches.filter((m) => m.rows.every((r) => r.scores[key] !== null));
    if (ms.length < 50) continue;
    const rows = ms.flatMap((m) => m.rows.map((r) => ({ ...r, v: r.scores[key], duration: m.duration })));
    const v = rows.map((r) => r.v);
    const lo = q(v, 0.4), hi = q(v, 0.6);
    const R = { matches: ms.length };

    // R1 — mediana de cada posicao entre o p40 e o p60 da escala inteira
    const posMed = [1, 2, 3, 4, 5].map((p) => med(rows.filter((r) => r.pos === p).map((r) => r.v)));
    R.R1 = { pass: posMed.every((m) => m >= lo && m <= hi), text: `${posMed.filter((m) => m >= lo && m <= hi).length}/5 (${posMed.map((m) => m.toFixed(0)).join(' ')}; faixa ${lo.toFixed(0)}-${hi.toFixed(0)})` };

    // R2 — herois com 200+ linhas: 80% com mediana entre p40 e p60
    const byHero = {};
    for (const r of rows) (byHero[r.hero] = byHero[r.hero] || []).push(r.v);
    const big = Object.values(byHero).filter((a) => a.length >= HERO_MIN_ROWS).map(med);
    R.R2 = big.length < 10
      ? { pass: null, text: `sem amostra (${big.length} herois com ${HERO_MIN_ROWS}+ linhas; precisa de 10)` }
      : { pass: big.filter((m) => m >= lo && m <= hi).length / big.length >= 0.8, text: `${(100 * big.filter((m) => m >= lo && m <= hi).length / big.length).toFixed(0)}% de ${big.length} herois` };

    // R3 — |r| com a duracao <= 0,10
    const rd = corr(rows.map((r) => r.duration), v);
    R.R3 = { pass: Math.abs(rd) <= 0.1, text: `r ${rd.toFixed(2)}` };

    // R4 — 1o e 2o a menos de 1 ponto (na nota arredondada, que é a que a tela mostra) em <= 10%
    const ties = ms.filter((m) => { const s = m.rows.map((r) => Math.round(r.scores[key])).sort((a, b) => b - a); return s[0] - s[1] < 1; }).length;
    R.R4 = { pass: ties / ms.length <= 0.1, text: `${(100 * ties / ms.length).toFixed(1)}%` };

    // R5 — dentro do time, contra a contribuicao descontada da media da posicao
    const teams = [];
    for (const m of ms) for (const side of [true, false]) {
      const t = m.rows.filter((r) => r.radiant === side);
      if (t.some((r) => r.ref === null)) continue;
      const sv = t.map((r) => r.scores[key]);
      const kv = t.map((r) => r.scores.kda3);
      const rv = t.map((r) => r.ref);
      const best = argmaxStrict(rv);
      teams.push({ id: m.id, side, rho: spearman(sv, rv), rhoK: spearman(kv, rv), best: best >= 0 && argmaxStrict(sv) === best ? 1 : 0, bestK: best >= 0 && argmaxStrict(kv) === best ? 1 : 0 });
    }
    const okT = teams.filter((t) => Number.isFinite(t.rho) && Number.isFinite(t.rhoK));
    R.teams = okT;
    if (okT.length >= 50) {
      R.R5 = { rho: mean(okT.map((t) => t.rho)), best: mean(okT.map((t) => t.best)) };
    }

    // R6 — relacao com o resultado (so relatado)
    const teamWin = ms.filter((m) => { const w = m.rows.filter((r) => r.win), l = m.rows.filter((r) => !r.win); return mean(w.map((r) => r.scores[key])) > mean(l.map((r) => r.scores[key])); }).length;
    const bestLoser = ms.filter((m) => { const i = argmaxStrict(m.rows.map((r) => r.scores[key])); return i >= 0 && !m.rows[i].win; }).length;
    R.R6 = `time vencedor com media maior ${(100 * teamWin / ms.length).toFixed(1)}% | melhor da partida no perdedor ${(100 * bestLoser / ms.length).toFixed(1)}%`;
    res[key] = R;
  }

  // R5 em relacao a kda3: diferenca pareada por time, IC95
  for (const key of Object.keys(res)) {
    const R = res[key];
    if (!R.R5 || key === 'kda3') continue;
    const t = R.teams;
    const [rl, rh] = bootCI(t, (x) => x.rho - x.rhoK);
    const [bl, bh] = bootCI(t, (x) => x.best - x.bestK);
    R.R5.vs = { rho: [rl, rh], best: [bl, bh] };
    R.R5.pass = rl > 0 && bl > 0;
  }

  const fmt = (r) => (r.pass === null ? 'n/d  ' : r.pass ? 'PASSA' : 'FALHA');
  console.log('\nR1 calibracao por posicao | R2 por heroi | R3 duracao | R4 empate no topo');
  for (const [key, R] of Object.entries(res)) {
    console.log(`  ${key.padEnd(10)} R1 ${fmt(R.R1)} ${R.R1.text}`);
    console.log(`  ${''.padEnd(10)} R2 ${fmt(R.R2)} ${R.R2.text} | R3 ${fmt(R.R3)} ${R.R3.text} | R4 ${fmt(R.R4)} ${R.R4.text}`);
  }
  console.log('\nR5 contribuicao dentro do time (Spearman medio | mesmo melhor do time), e diferenca para kda3 com IC95');
  for (const [key, R] of Object.entries(res)) {
    if (!R.R5) { console.log(`  ${key.padEnd(10)} sem medida (falta a referencia ou times com posicao)`); continue; }
    const vs = R.R5.vs ? ` | vs kda3: rho [${R.R5.vs.rho.map((x) => x.toFixed(3)).join(', ')}] melhor [${R.R5.vs.best.map((x) => (100 * x).toFixed(1)).join(', ')}] pts => ${R.R5.pass ? 'PASSA' : 'FALHA'}` : key === 'kda3' ? ' (linha de base)' : '';
    console.log(`  ${key.padEnd(10)} ${R.R5.rho.toFixed(3)} | ${(100 * R.R5.best).toFixed(1)}% de ${R.teams.length} times${vs}`);
  }
  console.log('\nR6 relacao com o resultado (so relatado; leitura A, sem piso)');
  for (const [key, R] of Object.entries(res)) console.log(`  ${key.padEnd(10)} ${R.R6}`);

  // R7 — IMP como sanidade
  const both = matches.flatMap((m) => m.rows).filter((r) => r.scores.imp !== null && r.scores.glint !== null);
  console.log('\nR7 IMP como sanidade (so relatado; abaixo de 0,5 exige explicacao escrita)');
  if (both.length >= 500) {
    const r7 = corr(both.map((r) => r.scores.glint), both.map((r) => r.scores.imp));
    console.log(`  Glint x IMP + 50: r ${r7.toFixed(2)} em ${both.length} linhas${r7 < 0.5 ? '  <= ABAIXO DE 0,5: explicar antes de lancar' : ''}`);
  } else console.log(`  sem amostra (${both.length} linhas com IMP)`);

  // R8 — lista e detalhe
  const lr = matches.flatMap((m) => m.rows).filter((r) => r.scores.glint !== null && r.scores['glint-any'] !== null);
  const r8 = corr(lr.map((r) => r.scores.glint), lr.map((r) => r.scores['glint-any']));
  const r8pass = r8 >= 0.95 && res.glint?.R1.pass && res['glint-any']?.R1.pass;
  console.log(`\nR8 lista x detalhe: r ${r8.toFixed(3)} (>= 0,95) e R1 nos dois => ${r8pass ? 'PASSA' : 'FALHA'}`);

  // R9 — composicao explicavel (desejavel)
  // Sobre os oito pesos: o termo de duracao do reajuste (`duration`) é normalizacao, nao
  // composicao, e fica de fora — leitura declarada na proposta, feita depois de ver o R3.
  const neg = Object.entries(MODEL.weights).flatMap(([role, w]) => w.slice(1).flatMap((v, i) => (v < 0 ? [`${role}:${G.GLINT_METRICS[i]} ${v}`] : [])));
  console.log(`R9 pesos nao negativos (desejavel): ${neg.length ? 'FALHA — ' + neg.join(', ') : 'PASSA'}`);
})();
