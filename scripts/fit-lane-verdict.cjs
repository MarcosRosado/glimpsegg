/**
 * Ajuste do VEREDITO DE ROTA PROPRIO (docs/PLANO-OPENDOTA.md, Fase 3). Gera os limiares que
 * vivem em `src/utils/laneVerdict.ts` e mede o aceite contra a STRATZ.
 *
 *   node scripts/fit-lane-verdict.cjs          variantes (7.41), aceite (7.41 e 7.42), estratos
 *   node scripts/fit-lane-verdict.cjs --json   so o bloco para colar em LANE_VERDICT_MODEL
 *
 * A REGRA (D1, decidida em 2026-11-19): diferenca de patrimonio e de xp aos 10 minutos entre
 * quem estava na rota. Nada da partida inteira entra — nem vitoria, nem mortes, nem Glint.
 * "Quem estava na rota" é o campo `lane` da OpenDota (1 = bot, 2 = mid, 3 = top; conferido
 * abaixo, rota a rota). "Aos 10 minutos" é o indice 10 de `networth_t`/`xp_t`: o indice 0 é
 * o ouro inicial (600), entao o indice t é o fim do minuto t.
 *
 * TUDO ABAIXO FOI FIXADO ANTES DE CALCULAR QUALQUER CONCORDANCIA (protocolo do §5 do plano):
 *
 *  1. Taxas de disparo, nao concordancia, definem os limiares. Sobre as rotas de 7.41:
 *       - EMPATE = os 25% de rotas com a menor diferenca (faixa do meio);
 *       - ATROPELO = os 10% com a maior diferenca (o meio do alvo de 5% a 15% que o projeto
 *         usa para tag; a STRATZ chama de atropelo 14%, e imitar a taxa dela nao é o alvo).
 *     O limiar é o quantil de |score| que dispara nessas taxas, e vale igual em 7.42.
 *     Por que isto importa: o aceite so conta rotas em que AS DUAS fontes dizem que alguem
 *     venceu, entao alargar o empate sobe a concordancia mecanicamente. A faixa é fixada por
 *     taxa, e a cobertura (fatia das rotas decididas pela STRATZ que a regra tambem decide)
 *     sai impressa ao lado de todo numero de concordancia.
 *  2. As variantes (so patrimonio ou patrimonio + xp; soma ou media por cabeca; diferenca
 *     relativa ou absoluta) sao escolhidas SO em 7.41, pela concordancia nas taxas acima.
 *     Empate na primeira casa decimal fica com a mais simples. O teste em 7.42 roda uma vez,
 *     depois da escolha — nao repete a falha que o cabecalho do Glint admite (variantes
 *     escolhidas olhando o teste).
 *  3. Aceite (plano, Fase 3): direcao igual a da STRATZ em >= 90% das rotas em que as duas
 *     dizem que alguem venceu, nos pares de 7.41 e de 7.42. Resultado no limite conta como
 *     reprovacao: passa so se o limite INFERIOR do intervalo de Wilson de 95% ficar em 90% ou
 *     mais, nos dois patches. Reprovado ⇒ o app mostra "Vantagem aos 10 min" com o numero ao
 *     lado, nunca "Rota vencida", e o modelo nao é reajustado ate passar (§5).
 *  4. Linha de base recalculada na MESMA estatistica: so patrimonio, soma, relativa, empate
 *     se |dif| < 10%. O 82% do §1 do plano saiu de 51 rotas e contava empate x empate como
 *     acerto — nao é comparavel com o aceite.
 *
 * DECIDIDO DEPOIS DA PRIMEIRA EXECUCAO, SO COM O NUMERO DO TREINO (2026-11-19): rota DESIGUAL
 * (2v1, 1v2, 3v2 — uns 5% das rotas) concorda 84,5% em 7.41 (n=58), abaixo do aceite, contra
 * 100% nas pareadas. Ela continua medida, mas o app nunca a chama de "Rota vencida": sai como
 * "Vantagem aos 10 min" (`evenLaneOnly`). A primeira execucao imprimiu o teste junto; a regra
 * se apoia no numero do treino, e o do teste (81,8%, n=22) só confirmou o lado.
 *
 * Rota de fora: lado vazio (ninguem de um dos times naquela rota) ou jogador sem serie de
 * 11 minutos. No app isso é `UNKNOWN`, e o badge some.
 *
 * Totalmente offline: le `.gabarito/pairs/`. Rodar da raiz.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pathToFileURL } = require('url');

const DIR = path.join(process.cwd(), '.gabarito', 'pairs');
const TRAIN_PATCH = 60; // 7.41 na OpenDota
const TEST_PATCH = 61; // 7.42
const TIE_RATE = 0.25;
const STOMP_RATE = 0.1;
const ACCEPT_MIN = 0.9;
const MINUTE = 10;
const LANES = [
  [1, 'bottomLaneOutcome', 'bot'],
  [2, 'midLaneOutcome', 'mid'],
  [3, 'topLaneOutcome', 'top'],
];

/** STRATZ -> direcao (+1 Radiant, -1 Dire, 0 empate) e intensidade. */
function stratzClass(out) {
  if (out === 'RADIANT_VICTORY') return { dir: 1, stomp: false };
  if (out === 'RADIANT_STOMP') return { dir: 1, stomp: true };
  if (out === 'DIRE_VICTORY') return { dir: -1, stomp: false };
  if (out === 'DIRE_STOMP') return { dir: -1, stomp: true };
  if (out === 'TIE') return { dir: 0, stomp: false };
  return null;
}

const rel = (a, b) => (a + b > 0 ? (a - b) / ((a + b) / 2) : 0);
const mean = (xs) => xs.reduce((s, v) => s + v, 0) / xs.length;
const sum = (xs) => xs.reduce((s, v) => s + v, 0);

/** As variantes candidatas. `simplicity` desempata (menor = mais simples). */
const VARIANTS = [
  { id: 'nw-sum-rel', xp: false, agg: 'sum', diff: 'rel', simplicity: 0 },
  { id: 'nw-head-rel', xp: false, agg: 'head', diff: 'rel', simplicity: 1 },
  { id: 'nw-sum-abs', xp: false, agg: 'sum', diff: 'abs', simplicity: 1 },
  { id: 'nw-head-abs', xp: false, agg: 'head', diff: 'abs', simplicity: 2 },
  { id: 'nwxp-sum-rel', xp: true, agg: 'sum', diff: 'rel', simplicity: 2 },
  { id: 'nwxp-head-rel', xp: true, agg: 'head', diff: 'rel', simplicity: 3 },
  { id: 'nwxp-sum-abs', xp: true, agg: 'sum', diff: 'abs', simplicity: 3 },
  { id: 'nwxp-head-abs', xp: true, agg: 'head', diff: 'abs', simplicity: 4 },
];

function score(v, lane) {
  const f = v.agg === 'sum' ? sum : mean;
  const nwR = f(lane.rad.map((p) => p.nw));
  const nwD = f(lane.dire.map((p) => p.nw));
  const xpR = f(lane.rad.map((p) => p.xp));
  const xpD = f(lane.dire.map((p) => p.xp));
  const d = v.diff === 'rel' ? rel : (a, b) => a - b;
  return v.xp ? (d(nwR, nwD) + d(xpR, xpD)) / 2 : d(nwR, nwD);
}

function quantile(sorted, q) {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)));
  return sorted[i];
}

/** Limiares por taxa sobre |score| das rotas de treino. */
function calibrate(v, lanes, tieRate = TIE_RATE, stompRate = STOMP_RATE) {
  const abs = lanes.map((l) => Math.abs(score(v, l))).sort((a, b) => a - b);
  return { tie: quantile(abs, tieRate), stomp: quantile(abs, 1 - stompRate) };
}

function classify(s, th) {
  const a = Math.abs(s);
  if (a < th.tie) return { dir: 0, stomp: false };
  return { dir: Math.sign(s), stomp: a >= th.stomp };
}

function wilson(k, n, z = 1.96) {
  if (!n) return [NaN, NaN];
  const p = k / n;
  const den = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - r) / den, (c + r) / den];
}

/** A estatistica do aceite + cobertura + taxas. */
function evaluate(lanes, verdictOf) {
  let both = 0, same = 0, stDecided = 0, alsoDecided = 0, ties = 0, stomps = 0;
  for (const l of lanes) {
    const ours = verdictOf(l);
    if (ours.dir === 0) ties++;
    if (ours.stomp) stomps++;
    if (l.st.dir !== 0) {
      stDecided++;
      if (ours.dir !== 0) alsoDecided++;
    }
    if (l.st.dir !== 0 && ours.dir !== 0) {
      both++;
      if (l.st.dir === ours.dir) same++;
    }
  }
  const [lo, hi] = wilson(same, both);
  return {
    lanes: lanes.length,
    both,
    same,
    agreement: both ? same / both : NaN,
    lo,
    hi,
    coverage: stDecided ? alsoDecided / stDecided : NaN,
    tieRate: ties / lanes.length,
    stompRate: stomps / lanes.length,
  };
}

const pct = (x) => (Number.isFinite(x) ? `${(100 * x).toFixed(1)}%` : '—');
const fmt = (m) =>
  `concordancia ${pct(m.agreement).padStart(6)} (${m.same}/${m.both}, IC95 ${pct(m.lo)}–${pct(m.hi)}) | cobertura ${pct(m.coverage)} | empate ${pct(m.tieRate)} | atropelo ${pct(m.stompRate)}`;

function loadLanes() {
  let files = [];
  try {
    files = fs.readdirSync(DIR).filter((n) => n.endsWith('.json.gz'));
  } catch {
    // tratado pelo chamador
  }
  let index = {};
  try {
    index = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf-8')).pairs || {};
  } catch {
    // sem indice: estratos de ranque e duracao saem como "?"
  }
  const lanes = [];
  const skipped = { emptySide: 0, shortSeries: 0, noOutcome: 0 };
  let matches = 0;
  for (const name of files) {
    let p;
    try {
      p = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, name))).toString('utf-8'));
    } catch {
      continue;
    }
    if (!p.od?.players || !p.st) continue;
    matches++;
    const meta = index[String(p.id)] || {};
    for (const [laneId, key, laneName] of LANES) {
      const st = stratzClass(p.st[key]);
      if (!st) {
        skipped.noOutcome++;
        continue;
      }
      const inLane = p.od.players.filter((o) => o.lane === laneId);
      const rows = inLane.map((o) => ({
        radiant: o.player_slot < 128,
        nw: o.networth_t?.[MINUTE],
        xp: o.xp_t?.[MINUTE],
      }));
      if (rows.some((r) => typeof r.nw !== 'number' || typeof r.xp !== 'number')) {
        skipped.shortSeries++;
        continue;
      }
      const rad = rows.filter((r) => r.radiant);
      const dire = rows.filter((r) => !r.radiant);
      if (!rad.length || !dire.length) {
        skipped.emptySide++;
        continue;
      }
      lanes.push({
        match: p.id,
        patch: p.od.patch,
        lane: laneName,
        comp: `${rad.length}v${dire.length}`,
        even: rad.length === dire.length,
        rank: meta.rank || '?',
        dur: meta.dur || '?',
        rad,
        dire,
        st,
      });
    }
  }
  return { lanes, skipped, matches };
}

/**
 * Paridade com o app: carrega `src/utils/laneVerdict.ts` pelo `runnerImport` do Vite (como o
 * accept-phase1.cjs) e confere que a funcao embarcada, com os limiares colados em
 * `LANE_VERDICT_MODEL`, da o mesmo outcome que esta regra em toda rota. Sem isso o aceite
 * mediria o script, nao o app.
 */
async function checkAppParity(lanes, block, verdict) {
  let mod;
  try {
    const root = process.env.GLIMPSE_ROOT || path.resolve(__dirname, '..');
    const vite = await import(pathToFileURL(require.resolve('vite', { paths: [root] })).href);
    ({ module: mod } = await vite.runnerImport(path.join(root, 'src/utils/laneVerdict.ts'), { configFile: false, root }));
  } catch (e) {
    console.log(`  nao consegui carregar src/utils/laneVerdict.ts: ${e.message}`);
    return;
  }
  const app = mod.LANE_VERDICT_MODEL;
  const same = app.variant === block.variant && app.tieThreshold === block.tieThreshold && app.stompThreshold === block.stompThreshold && app.evenLaneOnly === block.evenLaneOnly;
  console.log(`  limiares no app: ${app.variant} empate ${app.tieThreshold} atropelo ${app.stompThreshold} => ${same ? 'iguais aos deste ajuste' : 'DIFERENTES — cole o bloco do --json em LANE_VERDICT_MODEL'}`);
  if (!same) return;
  const toId = { bot: 1, mid: 2, top: 3 };
  const key = { bot: 'bottom', mid: 'mid', top: 'top' };
  let diff = 0;
  for (const l of lanes) {
    const input = [...l.rad.map((p) => ({ lane: toId[l.lane], isRadiant: true, networth10: p.nw })), ...l.dire.map((p) => ({ lane: toId[l.lane], isRadiant: false, networth10: p.nw }))];
    const got = mod.measureLanes(input)[key[l.lane]]?.outcome ?? null;
    const o = verdict(l);
    const want = block.evenLaneOnly && !l.even ? null : o.dir === 0 ? 'TIE' : `${o.dir > 0 ? 'RADIANT' : 'DIRE'}_${o.stomp ? 'STOMP' : 'VICTORY'}`;
    if (got !== want) diff++;
  }
  console.log(`  funcao do app x esta regra: ${lanes.length - diff}/${lanes.length} rotas com o mesmo outcome${diff ? '  <= DIVERGE' : ''}`);
}

(async () => {
  const { lanes, skipped, matches } = loadLanes();
  const train = lanes.filter((l) => l.patch === TRAIN_PATCH);
  const test = lanes.filter((l) => l.patch === TEST_PATCH);
  if (train.length < 150 || test.length < 150) {
    console.log(`rotas insuficientes: treino (7.41) ${train.length}, teste (7.42) ${test.length}. Rode scripts/collect-pairs.cjs.`);
    process.exit(1);
  }

  // --- 1. escolha da variante, SO em 7.41 -----------------------------------------------
  const trials = VARIANTS.map((v) => {
    const th = calibrate(v, train);
    return { v, th, m: evaluate(train, (l) => classify(score(v, l), th)) };
  });
  const best = [...trials].sort((a, b) => {
    const da = Math.round(a.m.agreement * 1000);
    const db = Math.round(b.m.agreement * 1000);
    return db - da || a.v.simplicity - b.v.simplicity;
  })[0];
  const { v } = best;
  // O aceite é medido com o limiar ARREDONDADO que vai para o app, nao com o de precisao
  // cheia — senao as rotas na fronteira mediriam outra regra (eram 2 de 2.429).
  const round = (x) => Number(x.toFixed(v.diff === 'rel' ? 4 : 0));
  const th = { tie: round(best.th.tie), stomp: round(best.th.stomp) };
  const verdict = (l) => classify(score(v, l), th);

  // --- 2. aceite ------------------------------------------------------------------------
  const trainM = evaluate(train, verdict);
  const testM = evaluate(test, verdict);
  const passes = (m) => m.lo >= ACCEPT_MIN;
  const evenTrain = evaluate(train.filter((l) => l.even), verdict);
  const evenTest = evaluate(test.filter((l) => l.even), verdict);
  const unevenTrain = evaluate(train.filter((l) => !l.even), verdict);
  const accepted = passes(trainM) && passes(testM);

  const block = {
    fittedAt: new Date().toISOString().slice(0, 10),
    trainPatch: '7.41',
    trainLanes: train.length,
    testPatch: '7.42',
    testLanes: test.length,
    minute: MINUTE,
    variant: v.id,
    usesXp: v.xp,
    aggregation: v.agg,
    difference: v.diff,
    tieRate: TIE_RATE,
    stompRate: STOMP_RATE,
    tieThreshold: th.tie,
    stompThreshold: th.stomp,
    accepted,
    /** Rota desigual nunca vira veredito: concordancia de treino abaixo do aceite. */
    evenLaneOnly: !(unevenTrain.lo >= ACCEPT_MIN),
    test: {
      train: { agreement: Number(trainM.agreement.toFixed(3)), lo: Number(trainM.lo.toFixed(3)), both: trainM.both, coverage: Number(trainM.coverage.toFixed(3)) },
      test: { agreement: Number(testM.agreement.toFixed(3)), lo: Number(testM.lo.toFixed(3)), both: testM.both, coverage: Number(testM.coverage.toFixed(3)) },
      evenTest: { agreement: Number(evenTest.agreement.toFixed(3)), lo: Number(evenTest.lo.toFixed(3)), both: evenTest.both },
      unevenTrain: { agreement: Number(unevenTrain.agreement.toFixed(3)), lo: Number(unevenTrain.lo.toFixed(3)), both: unevenTrain.both },
    },
  };
  if (process.argv.includes('--json')) return console.log(JSON.stringify(block, null, 2));

  console.log(`VEREDITO DE ROTA — ${matches} partidas | rotas: treino ${train.length} (7.41), teste ${test.length} (7.42)`);
  console.log(`  fora: lado vazio ${skipped.emptySide} | serie curta ${skipped.shortSeries} | sem outcome da STRATZ ${skipped.noOutcome}`);
  const stDist = (ls) => {
    const c = { tie: 0, win: 0, stomp: 0 };
    for (const l of ls) c[l.st.dir === 0 ? 'tie' : l.st.stomp ? 'stomp' : 'win']++;
    return `empate ${pct(c.tie / ls.length)} | vitoria ${pct(c.win / ls.length)} | atropelo ${pct(c.stomp / ls.length)}`;
  };
  console.log(`  STRATZ em 7.41: ${stDist(train)}`);
  console.log(`  STRATZ em 7.42: ${stDist(test)}`);

  console.log(`\n1. VARIANTES — so 7.41, empate ${pct(TIE_RATE)} e atropelo ${pct(STOMP_RATE)} por quantil`);
  for (const t of trials) {
    const mark = t === best ? '  <= escolhida' : '';
    console.log(`  ${t.v.id.padEnd(14)} ${fmt(t.m)}${mark}`);
  }

  console.log(`\n   faixa de empate x concordancia, variante ${v.id}, so 7.41 (a decisao NAO depende desta tabela):`);
  for (const r of [0, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4]) {
    const t2 = calibrate(v, train, r);
    const m = evaluate(train, (l) => classify(score(v, l), t2));
    console.log(`     empate ${pct(r).padStart(6)}: concordancia ${pct(m.agreement).padStart(6)} | cobertura ${pct(m.coverage)}${r === TIE_RATE ? '  <= fixada' : ''}`);
  }

  const baseV = VARIANTS[0];
  const baseTh = { tie: 0.1, stomp: Infinity };
  const baseVerdict = (l) => classify(score(baseV, l), baseTh);
  console.log('\n2. ACEITE — direcao igual a da STRATZ onde as duas dizem que alguem venceu');
  console.log(`  regra: ${v.id} | empate se |score| < ${block.tieThreshold} | atropelo se >= ${block.stompThreshold}`);
  console.log(`  7.41 (treino) ${fmt(trainM)}`);
  console.log(`  7.42 (teste)  ${fmt(testM)}`);
  console.log(`  linha de base (so patrimonio, empate < 10%): 7.41 ${fmt(evaluate(train, baseVerdict))}`);
  console.log(`                                              7.42 ${fmt(evaluate(test, baseVerdict))}`);
  console.log(`  so rotas pareadas (onde o app mostra veredito): 7.41 ${fmt(evenTrain)}`);
  console.log(`                                                  7.42 ${fmt(evenTest)}`);
  console.log(`  rotas desiguais, 7.41: ${fmt(unevenTrain)} => ${block.evenLaneOnly ? 'saem como "Vantagem aos 10 min"' : 'entram no veredito'}`);
  // Informativo, fora do criterio: classe exata (empate / vitoria / atropelo, com lado).
  const exact = (ls) => {
    let ok = 0;
    for (const l of ls) {
      const o = verdict(l);
      if (o.dir === l.st.dir && (o.dir === 0 || o.stomp === l.st.stomp)) ok++;
    }
    return pct(ok / ls.length);
  };
  console.log(`  [fora do criterio] classe exata igual a da STRATZ: 7.41 ${exact(train)} | 7.42 ${exact(test)}`);
  console.log(
    accepted
      ? `  ACEITE ATINGIDO: limite inferior do IC95 >= ${pct(ACCEPT_MIN)} nos dois patches. O app pode dizer "Rota vencida".`
      : `  ACEITE NAO ATINGIDO (limite inferior do IC95 abaixo de ${pct(ACCEPT_MIN)}). O app mostra "Vantagem aos 10 min", nunca "Rota vencida".`,
  );

  console.log('\n3. ESTRATOS (teste, 7.42; treino entre parenteses)');
  const strata = [
    ['rota', (l) => l.lane],
    ['composicao', (l) => (l.even ? 'pareada' : 'desigual')],
    ['ranque', (l) => l.rank],
    ['duracao', (l) => l.dur],
  ];
  for (const [label, key] of strata) {
    const groups = [...new Set(lanes.map(key))].sort();
    console.log(`  ${label}:`);
    for (const g of groups) {
      const te = evaluate(test.filter((l) => key(l) === g), verdict);
      const tr = evaluate(train.filter((l) => key(l) === g), verdict);
      console.log(`    ${String(g).padEnd(16)} ${pct(te.agreement).padStart(6)} n=${String(te.both).padStart(3)} cob ${pct(te.coverage).padStart(6)}   (${pct(tr.agreement)} n=${tr.both})`);
    }
  }

  // Conferencia do mapeamento de rota: com top e bot trocados, as rotas laterais
  // desabariam e o mid ficaria intacto.
  console.log('\n   conferencia do campo `lane`: concordancia com top e bot TROCADOS na STRATZ (7.41):');
  const swapped = train.map((l) => {
    if (l.lane === 'mid') return l;
    const other = train.find((o) => o.match === l.match && o.lane === (l.lane === 'top' ? 'bot' : 'top'));
    return other ? { ...l, st: other.st } : null;
  }).filter(Boolean);
  console.log(`     laterais com troca: ${pct(evaluate(swapped.filter((l) => l.lane !== 'mid'), verdict).agreement)} (sem troca: ${pct(evaluate(train.filter((l) => l.lane !== 'mid'), verdict).agreement)})`);

  console.log('\n4. PARIDADE COM O APP');
  await checkAppParity(lanes, block, verdict);

  console.log('\npara colar em src/utils/laneVerdict.ts: node scripts/fit-lane-verdict.cjs --json');
})();
