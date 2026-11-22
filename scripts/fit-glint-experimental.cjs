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

/**
 * MODO `--target contrib` — o REAJUSTE CONTRA O ALVO PROPRIO (passo 3 do roteiro do Glint em
 * docs/PLANO-OPENDOTA.md; regua em docs/PROPOSTA-REGUA-GLINT.md, D8, leitura A).
 *
 *   node scripts/fit-glint-experimental.cjs --target contrib          metricas, pesos, limiares
 *   node scripts/fit-glint-experimental.cjs --target contrib --json   o bloco candidato
 *   ... --seen <arquivo>   lista congelada de ids (padrao .gabarito/glint-seen-2026-11-21.json)
 *
 * Tudo abaixo foi escrito ANTES do primeiro ajuste neste modo (2026-11-22). Uma mudanca veio
 * depois de ver numero, a v2 do fim deste bloco, e esta declarada la:
 *
 *  - ALVO: a contribuicao de `lib/impact.cjs` (probabilidade de vitoria atribuida por evento),
 *    descontada a media da posicao (`positionMean` de .gabarito/impact/wp-model.json, ajustado
 *    so em 7.41). As oito entradas continuam sendo os percentis da OpenDota: é o que a lista de
 *    partidas tem. Linha sem `position_est` fica fora (o alvo precisa da posicao).
 *  - DADOS: so partidas da lista congelada (`--seen`), 7.41 e 7.42, de pares e de volume. O alvo
 *    nao depende da STRATZ, entao o 7.42 ja visto entra no treino. Partida fora da lista nunca é
 *    lida: é o conjunto da medida oficial. Sem a lista, o script se recusa a rodar.
 *  - VALIDACAO INTERNA: partidas com id % 5 === 0 ficam de fora do primeiro ajuste e medem as
 *    variantes; o bloco final é reajustado em todas as partidas da lista.
 *  - O MODELO É O DE PESOS NAO NEGATIVOS (minimos quadrados com restricao w >= 0 nos oito pesos,
 *    intercepto livre), por R9: so assim o tooltip podera dizer o que puxou a nota. O ajuste sem
 *    restricao sai impresso como CONTROLE, para mostrar quanto a restricao custa; ele nao é
 *    candidato, seja qual for o numero.
 *  - ESCALA: a regressao fala em probabilidade de vitoria; a tela, de 0 a 100. A conversao é
 *    afim e entra nos pesos: a mediana das previsoes no treino vira 50, e a distancia p10-p90
 *    vira 48 pontos, a mesma largura do Glint atual na tela (p10/p50/p90 de 21/45/69). Uma
 *    conversao para os pesos por papel (core e suporte juntos, mesma unidade) e outra para os
 *    pesos sem papel.
 *  - LIMIARES por TAXA-ALVO de disparo nas linhas do treino, coluna por papel (nao mais "mesma
 *    taxa de um limiar de IMP", que nao existe neste alvo). As taxas arredondam as que a tela ja
 *    usa, com os dois extremos simetricos em 1% (eram 0,4% e 0,9%):
 *    acima de extremeHigh 1%, elite 5%, stomp 8%, strong 12%, good 22%, impact 35%, neutral 50%
 *    (a mediana); abaixo de poor 40%, weak 20%, extremeLow 1%.
 *
 * O veredito nao sai daqui: sai do `measure-glint.cjs --model <bloco>` em partidas que este
 * ajuste nao viu (as de depois do SEGUNDO congelamento). Este modo so imprime a validacao
 * interna para mostrar que o ajuste nao quebrou.
 *
 * V2 (2026-11-22, DEPOIS de ver numero — declarado). A v1 (o bloco acima, sem duracao; guardada
 * em .gabarito/glint-candidate-2026-11-22.json) passou R1, R2, R4, R5, R8 e R9 na previa
 * exploratoria (`measure-glint.cjs --explore --model`, so partidas da lista de 2026-11-21) e
 * FALHOU R3: r 0,14 com a duracao (0,12 sem papel). Diagnostico nas mesmas partidas: o alvo nao
 * tem relacao com a duracao (r 0,000); o vies vem das entradas — o percentil é por heroi em
 * qualquer duracao, e partida longa infla taxa por minuto (xp/min 0,52, ouro/min e dano 0,29).
 * Por isso a v2 poe a DURACAO (minutos) como termo LIVRE, de qualquer sinal, no mesmo ajuste:
 * com ele livre, a previsao sai sem correlacao com a duracao no treino, por construcao. A
 * duracao é constante dentro da partida, entao nao reordena ninguem no time (R5, R4 e o melhor
 * do time so mudam pelos oito pesos reajustados). O coeficiente fica num campo proprio
 * (`duration`), fora de `weights`: R9 se le sobre os oito pesos, e a duracao é normalizacao, nao
 * composicao — leitura feita depois de ver o R3, e dita assim na proposta.
 * O TETO do minuto (`DURATION_CAP_MIN`) se decide pela tabela de LINEARIDADE, que sai so da
 * parte do ajuste (id % 5 !== 0), antes de olhar o holdout: se a nota media de uma faixa da
 * ponta (menos de 25 ou mais de 60 min) se afastar mais de 3 pontos da media das faixas de 30
 * a 50, o minuto ganha teto na borda dessa faixa; senao, sem teto. Tudo o mais da v1 vale igual.
 *
 * V3 e V4 (mesmo dia, tambem depois de ver numero). A v2 (duracao por papel; bloco em
 * .gabarito/glint-candidate-2026-11-22-v2.json) resolveu R3 (holdout r 0,009) mas derrubou R8
 * para 0,934: core e suporte ficaram com coeficientes muito diferentes (-0,04 e -0,92 pontos
 * por minuto) e a lista nao sabe o papel. A v3 (pesos sem papel aprendendo a nota do detalhe)
 * nao mudou nada (0,933) e ficou so como controle. A V4, que é o codigo de hoje, usa UM
 * coeficiente de duracao para os tres conjuntos (`fitShared`), com os pesos sem papel imitando o
 * detalhe. Pela regra do teto acima, a faixa de 60+ min se afastou 3,3 pontos (> 3) e o minuto
 * ganhou teto de 60. Bloco em .gabarito/glint-candidate-2026-11-22-v4.json.
 * O HOLDOUT FOI LIDO EM TODA ITERACAO (v1 a v4): ele deixou de ser limpo e so serve de
 * conferencia. Limpo, so o conjunto de depois do segundo congelamento.
 * Holdout da v4: R3 passa (0,010); R5 por papel 0,548, acima dos 0,403 do kda3; mas R8 0,948
 * (piso 0,95) e R1 da lista FALHA (posicao 2 com mediana 56 para faixa 45-55). Por isso a v4
 * NAO foi travada como candidato: a decisao foi para o dono (plano, roteiro do Glint).
 *
 * V5 (2026-11-22, opcao (b) escolhida pelo dono: "dar a lista um sinal de papel"). Escrita ANTES
 * do primeiro ajuste da v5:
 *  - O SINAL: a FATIA DE CORE do heroi, p = linhas em posicao 1-3 / linhas com posicao, contada
 *    nas partidas de treino (lista congelada). Heroi com menos de HERO_SHARE_MIN_ROWS (100)
 *    linhas fica sem fatia. Nao sao os `roles` da Valve em constants/heroes.ts: quase todo heroi
 *    la lista "Carry" e "Support" juntos.
 *  - A NOTA SEM POSICAO (lista de partidas e partida nao parseada) passa a ser o detalhe
 *    ESPERADO para aquele heroi: p x nota de core + (1 - p) x nota de suporte, antes do corte em
 *    0..100. Heroi sem fatia cai nos pesos sem papel da v4, como antes.
 *  - Pesos, duracao, teto e limiares: os da v4, sem mudanca. So a perna sem posicao muda.
 *  - Na validacao interna a fatia sai SO da parte do ajuste (id % 5 !== 0); no bloco final, de
 *    todas as partidas da lista.
 *  - REGRA DE TRAVA, escrita antes de ver numero: a v5 vira candidato se, no holdout interno,
 *    passar R1 nas duas pernas, R3 nas duas e R8 (r >= 0,95). Senao, volta ao dono. Lembrete: o
 *    holdout ja foi lido nas v1-v4, entao isto é conferencia, nao medida.
 * RESULTADO (holdout, perna sem posicao): R1 passa (53 55 50 46 47, faixa 45-55; so 7.42 tambem),
 * R3 r 0,003, R8 0,975 (a v4 dava 0,948), R5 0,509 (a v4 dava 0,441). Pela regra, a v5 FOI
 * TRAVADA em 2026-11-22 01:28 como .gabarito/glint-candidate-2026-11-22-v5.json (103 herois com
 * fatia). A medida dela é a linha "reajuste do Glint" da rotina diaria. Mexer no candidato
 * depois disso exige terceiro congelamento.
 */
const TARGET_RATES = {
  high: { extremeHigh: 0.01, elite: 0.05, stomp: 0.08, strong: 0.12, good: 0.22, impact: 0.35, neutral: 0.5 },
  low: { poor: 0.4, weak: 0.2, extremeLow: 0.01 },
};
const SCALE_CENTER = 50;
/** Teto do minuto no termo de duracao; `null` = sem teto. Ver a v2 no cabecalho. */
const DURATION_CAP_MIN = 60;
/** v5: heroi com menos linhas que isto (com posicao, no treino) fica sem fatia de core. */
const HERO_SHARE_MIN_ROWS = 100;
const SCALE_P10_P90 = 48;

/**
 * Minimos quadrados com w >= 0 nos oito pesos, intercepto livre e, com `withDuration`, um
 * coeficiente LIVRE (de qualquer sinal) para a duracao: descida por coordenada projetada.
 * Devolve [intercepto, ...oito pesos, (duracao)].
 */
function fitLinear(rows, { withDuration = false, nonNegative = true } = {}) {
  const feats = (r) => (withDuration ? [...r.x, r.dur] : r.x);
  const k = METRICS.length + (withDuration ? 1 : 0);
  const free = (j) => j >= METRICS.length;
  const n = rows.length;
  const mx = Array(k).fill(0);
  let my = 0;
  for (const r of rows) { feats(r).forEach((v, i) => (mx[i] += v / n)); my += r.y / n; }
  const A = Array.from({ length: k }, () => Array(k).fill(0));
  const b = Array(k).fill(0);
  for (const r of rows) {
    const xc = feats(r).map((v, i) => v - mx[i]);
    const yc = r.y - my;
    for (let i = 0; i < k; i++) {
      b[i] += xc[i] * yc;
      for (let j = 0; j < k; j++) A[i][j] += xc[i] * xc[j];
    }
  }
  const w = Array(k).fill(0);
  for (let sweep = 0; sweep < 5000; sweep++) {
    let moved = 0;
    for (let j = 0; j < k; j++) {
      let g = b[j];
      for (let i = 0; i < k; i++) g -= A[j][i] * w[i];
      const step = w[j] + g / A[j][j];
      const next = free(j) || !nonNegative ? step : Math.max(0, step);
      moved = Math.max(moved, Math.abs(next - w[j]));
      w[j] = next;
    }
    if (moved < 1e-12) break;
  }
  return [my - w.reduce((s, v, i) => s + v * mx[i], 0), ...w];
}

/** w = [intercepto, ...oito pesos, (coeficiente da duracao)]; `r.dur` em minutos, ja com teto. */
const rawPredict = (w, r) => w[0] + r.x.reduce((s, v, i) => s + v * w[i + 1], 0) + (w.length > METRICS.length + 1 ? w[METRICS.length + 1] * r.dur : 0);
const quant = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

/** Converte pesos em probabilidade para a escala da tela: mediana -> 50, p10-p90 -> 48 pontos. */
function toScreenScale(sets, rowsBySet) {
  const preds = rowsBySet.flatMap(([key, rows]) => rows.map((r) => rawPredict(sets[key], r)));
  const m = quant(preds, 0.5);
  const k = SCALE_P10_P90 / (quant(preds, 0.9) - quant(preds, 0.1));
  const out = {};
  for (const [key] of rowsBySet) out[key] = [SCALE_CENTER + k * (sets[key][0] - m), ...sets[key].slice(1).map((v) => k * v)];
  return out;
}

function rankOf(a) {
  const s = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
  const out = Array(a.length);
  for (let i = 0; i < s.length;) {
    let j = i;
    while (j + 1 < s.length && s[j + 1][0] === s[i][0]) j++;
    for (let t = i; t <= j; t++) out[s[t][1]] = (i + j) / 2;
    i = j + 1;
  }
  return out;
}
function argmaxStrict(a) {
  const m = Math.max(...a);
  const idx = a.flatMap((v, i) => (v === m ? [i] : []));
  return idx.length === 1 ? idx[0] : -1;
}

/** Dentro do time, como o R5: Spearman medio com o alvo e "mesmo melhor do time". */
function withinTeam(matches, score) {
  let rho = 0, best = 0, n = 0;
  for (const m of matches) for (const side of [true, false]) {
    const t = m.filter((r) => r.radiant === side);
    const sv = t.map(score), tv = t.map((r) => r.y);
    const c = corr(rankOf(sv), rankOf(tv));
    if (!Number.isFinite(c)) continue;
    const bt = argmaxStrict(tv);
    rho += c; best += bt >= 0 && argmaxStrict(sv) === bt ? 1 : 0; n++;
  }
  return { teams: n, rho: Number((rho / n).toFixed(3)), bestPct: Number(((100 * best) / n).toFixed(1)) };
}

function fitContrib() {
  const { attributable, attribute } = require('./lib/impact.cjs');
  const ROOT = path.join(process.cwd(), '.gabarito');
  const seenArg = process.argv.indexOf('--seen');
  const seenFile = seenArg > 0 ? path.resolve(process.argv[seenArg + 1]) : path.join(ROOT, 'glint-seen-2026-11-21.json');
  let seen, model;
  try {
    seen = new Set(JSON.parse(fs.readFileSync(seenFile, 'utf-8')).ids);
  } catch {
    console.log(`falta a lista congelada ${path.relative(process.cwd(), seenFile)}: sem ela o ajuste leria o conjunto oficial.`);
    process.exit(1);
  }
  try {
    model = JSON.parse(fs.readFileSync(path.join(ROOT, 'impact', 'wp-model.json'), 'utf-8'));
  } catch {
    console.log('falta .gabarito/impact/wp-model.json: rode scripts/build-impact-reference.cjs.');
    process.exit(1);
  }
  if (model.trainPatch !== '7.41') {
    console.log(`a referencia foi ajustada em ${model.trainPatch}, nao em 7.41: o alvo poderia ter visto o conjunto oficial.`);
    process.exit(1);
  }

  const matches = [];
  let skippedUnseen = 0;
  for (const dir of ['pairs', 'matches']) {
    let names = [];
    try { names = fs.readdirSync(path.join(ROOT, dir)).filter((n) => n.endsWith('.json.gz')); } catch { continue; }
    for (const name of names) {
      const id = Number(name.replace('.json.gz', ''));
      if (!seen.has(id)) { skippedUnseen++; continue; }
      let p;
      try { p = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, dir, name))).toString('utf-8')); } catch { continue; }
      const od = p.od;
      if (!od || (od.patch !== TRAIN_PATCH && od.patch !== TEST_PATCH) || !attributable(od)) continue;
      const contrib = attribute(model.weights, od).contrib;
      const rows = [];
      for (let i = 0; i < 10; i++) {
        const o = od.players[i];
        const x = METRICS.map((k) => o.benchmarks?.[k]?.pct);
        const pos = o.position_est >= 1 && o.position_est <= 5 ? o.position_est : null;
        if (!pos || x.some((v) => typeof v !== 'number') || !Number.isFinite(contrib[i])) break;
        const minutes = od.duration / 60;
        const dur = DURATION_CAP_MIN ? Math.min(DURATION_CAP_MIN, minutes) : minutes;
        rows.push({ id, hero: o.hero_id, x, y: contrib[i] - model.positionMean[pos], core: pos <= 3, pos, radiant: !!o.isRadiant, patch: od.patch, minutes, dur });
      }
      if (rows.length === 10) matches.push(rows);
    }
  }
  if (matches.length < 500) {
    console.log(`partidas utilizaveis da lista congelada: ${matches.length} (precisa de 500).`);
    process.exit(1);
  }

  /**
   * v4: UM coeficiente de duracao para core, suporte e sem papel. Descida em blocos (convexa):
   * com beta fixo, cada papel ajusta os oito pesos sobre y - beta x minutos; com os papeis
   * fixos, beta sai do residuo centrado dentro de cada papel (cada papel tem intercepto proprio).
   * Na escala da tela o mesmo k multiplica tudo, entao o beta continua comum; os pesos sem papel
   * imitam a nota do detalhe com esse mesmo beta.
   */
  const fitShared = (ms) => {
    const tr = ms.flat();
    const groups = { core: tr.filter((r) => r.core), support: tr.filter((r) => !r.core) };
    let beta = 0;
    let sets;
    for (let it = 0; it < 200; it++) {
      sets = {};
      for (const [k, rows] of Object.entries(groups)) sets[k] = fitLinear(rows.map((r) => ({ ...r, y: r.y - beta * r.dur })), { nonNegative: true });
      let num = 0, den = 0;
      for (const [k, rows] of Object.entries(groups)) {
        const res = rows.map((r) => r.y - rawPredict(sets[k], r));
        const mr = res.reduce((a, v) => a + v, 0) / rows.length;
        const md = rows.reduce((a, r) => a + r.dur, 0) / rows.length;
        rows.forEach((r, i) => { num += (res[i] - mr) * (r.dur - md); den += (r.dur - md) ** 2; });
      }
      const next = num / den;
      if (Math.abs(next - beta) < 1e-10) { beta = next; break; }
      beta = next;
    }
    for (const k of Object.keys(sets)) sets[k] = [...sets[k], beta];
    const scaled = toScreenScale(sets, [['core', groups.core], ['support', groups.support]]);
    const bs = scaled.core[METRICS.length + 1];
    const asDetail = tr.map((r) => ({ ...r, y: rawPredict(r.core ? scaled.core : scaled.support, r) - bs * r.dur }));
    return { ...scaled, any: [...fitLinear(asDetail, { nonNegative: true }), bs] };
  };
  const fitSets = (ms, opts) => {
    if (opts.sharedDuration) return fitShared(ms);
    const tr = ms.flat();
    const fitter = (rows) => fitLinear(rows, opts);
    const sets = { core: fitter(tr.filter((r) => r.core)), support: fitter(tr.filter((r) => !r.core)) };
    const scaled = toScreenScale(sets, [['core', tr.filter((r) => r.core)], ['support', tr.filter((r) => !r.core)]]);
    if (opts.distillAny) {
      // v3: os pesos sem papel aprendem a NOTA DO DETALHE (por papel, sem o corte em 0..100),
      // nao a contribuicao — a lista imita o detalhe (R8). Ja sai na escala da tela.
      const asDetail = tr.map((r) => ({ ...r, y: rawPredict(r.core ? scaled.core : scaled.support, r) }));
      return { ...scaled, any: fitter(asDetail) };
    }
    return { ...scaled, any: toScreenScale({ any: fitter(tr) }, [['any', tr]]).any };
  };
  const screen = (w, r) => Math.round(Math.max(0, Math.min(100, rawPredict(w, r))));
  const byRoleOf = (W) => (r) => screen(r.core ? W.core : W.support, r);
  const noRoleOf = (W) => (r) => screen(W.any, r);

  /** v5: fatia de core por heroi (linhas em posicao 1-3 / linhas), so com HERO_SHARE_MIN_ROWS+. */
  const heroShare = (ms) => {
    const c = {};
    for (const r of ms.flat()) { const h = (c[r.hero] = c[r.hero] || { n: 0, core: 0 }); h.n++; if (r.core) h.core++; }
    return Object.fromEntries(Object.entries(c).filter(([, h]) => h.n >= HERO_SHARE_MIN_ROWS).map(([k, h]) => [k, h.core / h.n]));
  };
  /** v5: a nota sem posicao — o detalhe esperado para o heroi; sem fatia, os pesos sem papel. */
  const listOf = (W, share) => (r) => {
    const p = share[r.hero];
    if (p === undefined) return screen(W.any, r);
    return Math.round(Math.max(0, Math.min(100, p * rawPredict(W.core, r) + (1 - p) * rawPredict(W.support, r))));
  };

  const hold = matches.filter((m) => m[0].id % 5 === 0);
  const fitPart = matches.filter((m) => m[0].id % 5 !== 0);
  const V4 = { sharedDuration: true };
  const V3 = { withDuration: true, nonNegative: true, distillAny: true };
  const V2 = { withDuration: true, nonNegative: true };
  const V1 = { withDuration: false, nonNegative: true };
  const CONTROL = { withDuration: true, nonNegative: false };
  const part = { v4: fitSets(fitPart, V4), v3: fitSets(fitPart, V3), v2: fitSets(fitPart, V2), v1: fitSets(fitPart, V1), control: fitSets(fitPart, CONTROL) };
  // R8 no holdout: a nota da lista (sem papel) contra a do detalhe (por papel), por linha.
  const r8 = (W) => { const f = hold.flat(); return Number(corr(f.map(byRoleOf(W)), f.map(noRoleOf(W))).toFixed(3)); };
  const kda3 = (r) => (100 * (r.x[2] + r.x[3] + r.x[4])) / 3;
  const validation = {
    holdoutMatches: hold.length,
    candidate: { byRole: withinTeam(hold, byRoleOf(part.v4)), noRole: withinTeam(hold, noRoleOf(part.v4)) },
    v3: { byRole: withinTeam(hold, byRoleOf(part.v3)), noRole: withinTeam(hold, noRoleOf(part.v3)) },
    v2AnyOnTarget: { byRole: withinTeam(hold, byRoleOf(part.v2)), noRole: withinTeam(hold, noRoleOf(part.v2)) },
    v1NoDuration: { byRole: withinTeam(hold, byRoleOf(part.v1)), noRole: withinTeam(hold, noRoleOf(part.v1)) },
    unconstrained: { byRole: withinTeam(hold, byRoleOf(part.control)), noRole: withinTeam(hold, noRoleOf(part.control)) },
    kda3: withinTeam(hold, kda3),
  };
  // R3 no holdout: correlacao da nota com a duracao, e IC95 reamostrando PARTIDAS (a duracao
  // é da partida; reamostrar linhas estreitaria o intervalo dez vezes).
  const r3 = (ms, score) => {
    const r = (sample) => { const f = sample.flat(); return corr(f.map(score), f.map((x) => x.dur)); };
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const boots = Array.from({ length: 500 }, () => r(ms.map(() => ms[Math.floor(rnd() * ms.length)]))).sort((a, b) => a - b);
    return { r: Number(r(ms).toFixed(3)), ci95: [Number(boots[12].toFixed(3)), Number(boots[487].toFixed(3))] };
  };
  const hold742 = hold.filter((m) => m[0].patch === TEST_PATCH);
  validation.R3 = {
    candidateByRole: r3(hold, byRoleOf(part.v4)), candidateNoRole: r3(hold, noRoleOf(part.v4)),
    candidateByRole742: r3(hold742, byRoleOf(part.v4)), holdout742Matches: hold742.length,
    v1ByRole: r3(hold, byRoleOf(part.v1)),
  };
  // R1 no holdout, como o measure-glint: mediana de cada posicao contra o p40-p60 da escala.
  const r1 = (ms, score) => {
    const f = ms.flat();
    const v = f.map(score);
    const lo = quant(v, 0.4), hi = quant(v, 0.6);
    const meds = [1, 2, 3, 4, 5].map((p) => quant(f.filter((r) => r.pos === p).map(score), 0.5));
    return { pass: meds.every((m) => m >= lo && m <= hi), medians: meds, band: [lo, hi] };
  };
  validation.R1 = {
    byRole: r1(hold, byRoleOf(part.v4)), noRole: r1(hold, noRoleOf(part.v4)),
    byRole742: r1(hold742, byRoleOf(part.v4)), noRole742: r1(hold742, noRoleOf(part.v4)),
  };
  const sharePart = heroShare(fitPart);
  const listV5 = listOf(part.v4, sharePart);
  const holdFlat = hold.flat();
  validation.v5 = {
    heroesWithShare: Object.keys(sharePart).length,
    holdoutRowsWithShare: Number(((100 * holdFlat.filter((r) => sharePart[r.hero] !== undefined).length) / holdFlat.length).toFixed(1)),
    R1: r1(hold, listV5), R1_742: r1(hold742, listV5),
    R3: r3(hold, listV5),
    R5: withinTeam(hold, listV5),
    R8: Number(corr(holdFlat.map(byRoleOf(part.v4)), holdFlat.map(listV5)).toFixed(3)),
  };
  validation.R8 = { candidate: r8(part.v4), v3: r8(part.v3), v2AnyOnTarget: r8(part.v2), v1: r8(part.v1) };
  // Linearidade, na parte do AJUSTE (nunca no holdout): nota media por faixa de duracao.
  const bands = [[0, 25], [25, 30], [30, 35], [35, 40], [40, 45], [45, 50], [50, 60], [60, 999]];
  const fitFlat = fitPart.flat();
  const linearity = bands.map(([lo, hi]) => {
    const rs = fitFlat.filter((r) => r.minutes >= lo && r.minutes < hi);
    const avg = (f) => Number((rs.reduce((a, r) => a + f(r), 0) / rs.length).toFixed(1));
    return { band: `${lo}-${hi === 999 ? '' : hi}`, rows: rs.length, candidate: avg(byRoleOf(part.v4)), candidateNoRole: avg(noRoleOf(part.v4)), v1: avg(byRoleOf(part.v1)) };
  });

  const W = fitSets(matches, V4);
  const flat = matches.flat();
  const g = flat.map(byRoleOf(W)).sort((a, b) => a - b);
  const thresholds = {};
  for (const [name, rate] of Object.entries(TARGET_RATES.high)) thresholds[name] = g[g.length - Math.round(rate * g.length)];
  for (const [name, rate] of Object.entries(TARGET_RATES.low)) thresholds[name] = g[Math.round(rate * g.length) - 1];
  const fired = (t, high) => Number(((100 * g.filter((v) => (high ? v >= t : v <= t)).length) / g.length).toFixed(1));
  const nine = METRICS.length + 1;

  const block = {
    fittedAt: new Date().toISOString().slice(0, 10),
    target: 'contrib',
    version: 5,
    seenFile: path.basename(seenFile),
    trainMatches: matches.length,
    trainByPatch: { '7.41': matches.filter((m) => m[0].patch === TRAIN_PATCH).length, '7.42': matches.filter((m) => m[0].patch === TEST_PATCH).length },
    metrics: METRICS,
    weights: Object.fromEntries(Object.entries(W).map(([k, w]) => [k, w.slice(0, nine).map((v) => Number(v.toFixed(2)))])),
    /** Pontos de Glint por minuto de partida (normalizacao, fora de R9), minuto com teto. */
    duration: {
      capMinutes: DURATION_CAP_MIN,
      ...Object.fromEntries(Object.entries(W).map(([k, w]) => [k, Number(w[nine].toFixed(3))])),
    },
    /** v5: fatia de core do heroi (por hero_id), para a nota sem posicao. */
    heroCoreShare: Object.fromEntries(Object.entries(heroShare(matches)).map(([k, v]) => [k, Number(v.toFixed(3))])),
    heroCoreShareMinRows: HERO_SHARE_MIN_ROWS,
    thresholds,
    thresholdRates: Object.fromEntries([
      ...Object.keys(TARGET_RATES.high).map((k) => [k, fired(thresholds[k], true)]),
      ...Object.keys(TARGET_RATES.low).map((k) => [k, fired(thresholds[k], false)]),
    ]),
    median: g[g.length >> 1],
    validation,
    linearity,
  };
  if (process.argv.includes('--json')) return console.log(JSON.stringify(block, null, 2));

  console.log(`GLINT — REAJUSTE CONTRA O ALVO PROPRIO (contribuicao descontada da posicao)`);
  console.log(`lista congelada ${block.seenFile} | partidas ${matches.length} (7.41 ${block.trainByPatch['7.41']}, 7.42 ${block.trainByPatch['7.42']}) | fora da lista e nao lidas: ${skippedUnseen} arquivos`);
  console.log(`\nVALIDACAO INTERNA (${hold.length} partidas com id % 5 === 0, fora do primeiro ajuste) — dentro do time, contra o alvo:`);
  const vl = (name, v) => console.log(`  ${name.padEnd(40)} Spearman ${v.rho.toFixed(3)} | mesmo melhor do time ${v.bestPct}% (${v.teams} times)`);
  vl('v4 (duracao comum), por papel — CANDIDATO', validation.candidate.byRole);
  vl('v4 (duracao comum), sem papel — CANDIDATO', validation.candidate.noRole);
  vl('v3 (duracao por papel), por papel', validation.v3.byRole);
  vl('v3 (duracao por papel), sem papel', validation.v3.noRole);
  vl('v2 (sem papel contra o alvo), sem papel', validation.v2AnyOnTarget.noRole);
  vl('v1 (sem duracao), por papel', validation.v1NoDuration.byRole);
  vl('v1 (sem duracao), sem papel', validation.v1NoDuration.noRole);
  vl('sem restricao de sinal, por papel (controle)', validation.unconstrained.byRole);
  vl('sem restricao de sinal, sem papel (controle)', validation.unconstrained.noRole);
  vl('kda3 (linha de base)', validation.kda3);
  const R3v = validation.R3;
  const r3l = (name, v) => console.log(`  ${name.padEnd(40)} r ${v.r.toFixed(3)} | IC95 [${v.ci95.join(', ')}]`);
  console.log('\nR3 NO HOLDOUT (correlacao com a duracao; teto da regua: |r| <= 0,10):');
  r3l('v4 por papel', R3v.candidateByRole);
  r3l('v4 sem papel', R3v.candidateNoRole);
  r3l(`v4 por papel, so 7.42 (${R3v.holdout742Matches} partidas)`, R3v.candidateByRole742);
  r3l('v1 por papel', R3v.v1ByRole);
  console.log('\nR1 NO HOLDOUT (mediana por posicao 1..5 dentro do p40-p60 da escala), v4:');
  for (const [name, v] of [['por papel', validation.R1.byRole], ['sem papel', validation.R1.noRole], ['por papel, so 7.42', validation.R1.byRole742], ['sem papel, so 7.42', validation.R1.noRole742]]) {
    console.log(`  ${name.padEnd(20)} ${v.pass ? 'PASSA' : 'FALHA'} ${v.medians.join(' ')} | faixa ${v.band.join('-')}`);
  }
  const V5 = validation.v5;
  console.log(`\nV5 — PERNA SEM POSICAO PELA FATIA DE CORE DO HEROI (fatia da parte do ajuste: ${V5.heroesWithShare} herois; ${V5.holdoutRowsWithShare}% das linhas do holdout com fatia):`);
  console.log(`  R1 ${V5.R1.pass ? 'PASSA' : 'FALHA'} ${V5.R1.medians.join(' ')} | faixa ${V5.R1.band.join('-')}   (so 7.42: ${V5.R1_742.pass ? 'PASSA' : 'FALHA'} ${V5.R1_742.medians.join(' ')} | faixa ${V5.R1_742.band.join('-')})`);
  console.log(`  R3 r ${V5.R3.r.toFixed(3)} | IC95 [${V5.R3.ci95.join(', ')}]`);
  console.log(`  R5 Spearman ${V5.R5.rho.toFixed(3)} | mesmo melhor do time ${V5.R5.bestPct}%`);
  console.log(`  R8 (detalhe por papel x lista v5) r ${V5.R8.toFixed(3)} (piso 0,95)`);
  console.log(`\nR8 NO HOLDOUT (lista sem papel x detalhe por papel; piso da regua: r >= 0,95): v4 ${validation.R8.candidate} | v3 ${validation.R8.v3} | v2 ${validation.R8.v2AnyOnTarget} | v1 ${validation.R8.v1}`);
  console.log('\nLINEARIDADE (parte do ajuste, nunca o holdout): nota media por faixa de duracao');
  for (const b of linearity) console.log(`  ${b.band.padEnd(7)} ${String(b.rows).padStart(6)} linhas | v4 por papel ${String(b.candidate).padStart(5)} | v4 sem papel ${String(b.candidateNoRole).padStart(5)} | v1 ${String(b.v1).padStart(5)}`);
  console.log('  Nao é a medida: o veredito sai do measure-glint.cjs --model em partidas depois do segundo congelamento.');
  console.log(`\nLIMIARES por taxa-alvo (linhas do treino, por papel; mediana ${block.median}):`);
  for (const k of [...Object.keys(TARGET_RATES.high), ...Object.keys(TARGET_RATES.low)]) {
    const high = k in TARGET_RATES.high;
    console.log(`  ${k.padEnd(12)} ${high ? '>=' : '<='} ${String(thresholds[k]).padStart(3)}  alvo ${(100 * (high ? TARGET_RATES.high[k] : TARGET_RATES.low[k])).toFixed(0)}% | dispara em ${block.thresholdRates[k]}%`);
  }
  console.log('\npesos (intercepto, depois ' + METRICS.join(', ') + '):');
  for (const [k, w] of Object.entries(block.weights)) console.log(`  ${k.padEnd(8)} ${w.join('  ')}`);
  console.log(`duracao (pontos por minuto, ${DURATION_CAP_MIN ? 'teto ' + DURATION_CAP_MIN + ' min' : 'sem teto'}): core ${block.duration.core} | support ${block.duration.support} | any ${block.duration.any}`);
  console.log('\nbloco candidato: node scripts/fit-glint-experimental.cjs --target contrib --json > <arquivo>; medir com measure-glint.cjs --model <arquivo>');
}

(() => {
  if (process.argv.includes('--target')) {
    const t = process.argv[process.argv.indexOf('--target') + 1];
    if (t !== 'contrib') { console.log('uso: --target contrib'); process.exit(1); }
    return fitContrib();
  }
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
