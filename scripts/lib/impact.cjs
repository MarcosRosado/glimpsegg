/**
 * Referencia de CONTRIBUICAO para a regua propria do Glint (docs/PROPOSTA-REGUA-GLINT.md, §4):
 * probabilidade de vitoria adicionada, atribuida a quem a moveu. Nada aqui entra no app; é
 * a regua contra a qual o Glint é medido (criterio R5). Nao usa os PERCENTIS que o Glint usa,
 * mas usa os numeros crus por tras de cinco deles (ouro, xp, abates, mortes, dano em luta), e
 * a sobreposicao é medida, nao negada: descontada a media da posicao, a contribuicao
 * correlaciona 0,66 com a media dos percentis de abates/mortes/assistencias e 0,60 com o de
 * ouro/min (2026-11-21). Conferido no mesmo dia: `teamfights[].players[i]` é `players[i]`
 * (as 736.956 habilidades usadas em luta sao todas do jogador do mesmo indice).
 *
 * DUAS PECAS, cada uma com hipotese declarada:
 *
 * 1. MODELO DE PROBABILIDADE DE VITORIA. P(Radiant vence | vantagem de ouro, vantagem de xp,
 *    minuto), logistica com o peso de cada vantagem variando com o minuto (polinomio de grau 2
 *    em tau = minuto/30, teto em 60 min — degraus por faixa de minuto criariam saltos falsos de
 *    probabilidade na fronteira, e o salto viraria "impacto" de alguem). Entradas: os arrays
 *    `radiant_gold_adv` e `radiant_xp_adv` da partida parseada, que sao EXATAMENTE a soma de
 *    `gold_t`/`xp_t` de cada lado (conferido em 2026-11-21) — é o que permite decompor por
 *    jogador sem resto. O que o modelo nao ve (torre, barracks, Roshan, itens) fica fora da
 *    probabilidade e, portanto, fora da atribuicao.
 *
 * 2. ATRIBUICAO, minuto a minuto, em unidades de probabilidade de vitoria DO PROPRIO TIME.
 *    A soma do time no jogo inteiro é a variacao da probabilidade dele, do minuto 0 ao
 *    ultimo, a menos do residuo da linearizacao (que sai no diagnostico). Nao chega a 0 ou 1: o empurrao final ate o
 *    trono nao aparece em ouro nem xp.
 *    - minuto que cruza uma LUTA (`teamfights[]`): a variacao da janela da luta vai inteira
 *      para quem lutou. O lado que ganhou probabilidade divide o ganho pela participacao
 *      (metade pela fatia de dano + cura na luta, metade pela fatia de abates); o lado que
 *      perdeu divide a perda pelas mortes na luta. Sem morte do lado perdedor, a perda fica
 *      com quem participou (dano ou cura > 0), em partes iguais.
 *    - minuto fora de luta: linearizacao exata da logistica. Cada jogador recebe
 *      dP/d(ouro) x o ouro que ELE ganhou no minuto + dP/d(xp) x o xp dele. O que o time
 *      inimigo ganhou no minuto sai do time em partes iguais (1/5 para cada): ninguem sabe
 *      quem "deixou" o inimigo farmar, e a parte igual nao mexe na ordem dentro do time, que
 *      é o que o criterio R5 compara. A derivada é maior quando o jogo esta aberto (P perto
 *      de 0,5) e no minuto em que a vantagem pesa mais: é ai que o mesmo ouro "vale" mais.
 *    Morte fora de luta nao tira ponto de quem morreu (o ouro ganho, `gold_t`, nao cai na
 *    morte): o custo dela aparece como ganho do inimigo, dividido pelo time. Limitacao
 *    declarada.
 */

const TAU_CAP_MIN = 60;

/** Entradas da logistica no minuto t, com vantagens em milhares. */
function wpFeatures(goldAdv, xpAdv, minute) {
  const tau = Math.min(minute, TAU_CAP_MIN) / 30;
  const g = goldAdv / 1000;
  const x = xpAdv / 1000;
  return [1, g, g * tau, g * tau * tau, x, x * tau, x * tau * tau];
}

/** d(logit)/d(ouro em unidades) e d(logit)/d(xp em unidades) no minuto t. */
function logitSlopes(w, minute) {
  const tau = Math.min(minute, TAU_CAP_MIN) / 30;
  return {
    gold: (w[1] + w[2] * tau + w[3] * tau * tau) / 1000,
    xp: (w[4] + w[5] * tau + w[6] * tau * tau) / 1000,
  };
}

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

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

/** Logistica por Newton-Raphson, com L2 minimo so para estabilidade numerica. */
function fitLogistic(rows, iterations = 25) {
  const n = rows[0].f.length;
  let w = Array(n).fill(0);
  for (let it = 0; it < iterations; it++) {
    const H = Array.from({ length: n }, () => Array(n).fill(0));
    const grad = Array(n).fill(0);
    for (const r of rows) {
      const p = sigmoid(dot(w, r.f));
      const s = p * (1 - p);
      for (let i = 0; i < n; i++) {
        grad[i] += (r.y - p) * r.f[i];
        for (let j = 0; j < n; j++) H[i][j] += s * r.f[i] * r.f[j];
      }
    }
    for (let i = 0; i < n; i++) H[i][i] += 1e-6;
    const step = solve(H, grad);
    w = w.map((v, i) => v + step[i]);
    if (Math.max(...step.map(Math.abs)) < 1e-7) break;
  }
  return w;
}

/** Uma linha por minuto de cada partida: entradas e se a Radiant venceu. */
function wpRows(matches) {
  const rows = [];
  for (const od of matches) {
    const g = od.radiant_gold_adv;
    const x = od.radiant_xp_adv;
    if (!Array.isArray(g) || !Array.isArray(x) || typeof od.radiant_win !== 'boolean') continue;
    const T = Math.min(g.length, x.length);
    for (let t = 0; t < T; t++) rows.push({ f: wpFeatures(g[t], x[t], t), y: od.radiant_win ? 1 : 0, minute: t, matchId: od.match_id });
  }
  return rows;
}

/** P(Radiant vence) em cada minuto da partida. */
function wpSeries(w, od) {
  const g = od.radiant_gold_adv;
  const x = od.radiant_xp_adv;
  const T = Math.min(g.length, x.length);
  const out = new Array(T);
  for (let t = 0; t < T; t++) out[t] = sigmoid(dot(w, wpFeatures(g[t], x[t], t)));
  return out;
}

/** A partida tem tudo que a atribuicao precisa? */
function attributable(od) {
  return (
    Array.isArray(od.players) &&
    od.players.length === 10 &&
    Array.isArray(od.radiant_gold_adv) &&
    Array.isArray(od.radiant_xp_adv) &&
    Array.isArray(od.teamfights) &&
    od.players.every((p) => Array.isArray(p.gold_t) && Array.isArray(p.xp_t))
  );
}

/**
 * Contribuicao de cada jogador (ordem de `od.players`), em probabilidade de vitoria do
 * proprio time, mais diagnosticos: quanto da variacao total foi para luta, e o residuo da
 * linearizacao nos minutos fora de luta.
 */
function attribute(w, od) {
  // Serie de jogador pode ser mais curta que a de vantagem: corta tudo no menor comprimento,
  // senao um minuto sem `gold_t` vira NaN e contamina a soma inteira.
  const T = Math.min(od.radiant_gold_adv.length, od.radiant_xp_adv.length, ...od.players.map((p) => Math.min(p.gold_t.length, p.xp_t.length)));
  const P = wpSeries(w, od).slice(0, T);
  const side = od.players.map((p) => (p.isRadiant ? 1 : -1));
  const contrib = new Array(10).fill(0);
  const inFight = new Array(T).fill(false);
  let fightAbs = 0;
  let totalAbs = 0;
  let linResidualAbs = 0;
  for (let t = 0; t + 1 < T; t++) totalAbs += Math.abs(P[t + 1] - P[t]);

  // Lutas, em ordem. Janelas que se sobrepoem (luta que comeca no minuto em que a anterior
  // terminou) nao contam o mesmo minuto duas vezes: a segunda comeca onde a primeira parou.
  const fights = [...od.teamfights].filter((f) => Array.isArray(f.players) && f.players.length === 10).sort((a, b) => a.start - b.start);
  let lastEnd = -1;
  for (const f of fights) {
    // Luta do pre-jogo (start negativo, caso real) comeca no minuto 0.
    const a = Math.max(Math.floor(f.start / 60), lastEnd, 0);
    const b = Math.min(Math.ceil(f.end / 60), T - 1);
    if (b <= a) continue;
    lastEnd = b;
    for (let t = a; t < b; t++) inFight[t] = true;
    const dRad = P[b] - P[a];
    if (dRad === 0) continue;
    fightAbs += Math.abs(dRad);
    const winnerSide = dRad > 0 ? 1 : -1;
    const gain = Math.abs(dRad);
    const idx = [...Array(10).keys()];
    const winners = idx.filter((i) => side[i] === winnerSide);
    const losers = idx.filter((i) => side[i] !== winnerSide);
    const fp = f.players;
    const kills = (i) => Object.values(fp[i].killed || {}).reduce((s, v) => s + v, 0);
    const dmgHeal = (i) => (fp[i].damage || 0) + (fp[i].healing || 0);

    const sumDH = winners.reduce((s, i) => s + dmgHeal(i), 0);
    const sumK = winners.reduce((s, i) => s + kills(i), 0);
    for (const i of winners) {
      let share;
      if (sumDH > 0 && sumK > 0) share = 0.5 * (dmgHeal(i) / sumDH) + 0.5 * (kills(i) / sumK);
      else if (sumDH > 0) share = dmgHeal(i) / sumDH;
      else if (sumK > 0) share = kills(i) / sumK;
      else share = 1 / winners.length;
      contrib[i] += gain * share;
    }
    const sumD = losers.reduce((s, i) => s + (fp[i].deaths || 0), 0);
    const present = losers.filter((i) => dmgHeal(i) > 0 || (fp[i].deaths || 0) > 0);
    for (const i of losers) {
      let share;
      if (sumD > 0) share = (fp[i].deaths || 0) / sumD;
      else if (present.length) share = present.includes(i) ? 1 / present.length : 0;
      else share = 1 / losers.length;
      contrib[i] -= gain * share;
    }
  }

  // Fora de luta: linearizacao. dP = P(1-P) * d(logit); d(logit) = a*dGoldAdv + b*dXpAdv.
  for (let t = 0; t + 1 < T; t++) {
    if (inFight[t]) continue;
    const pm = 0.5 * (P[t] + P[t + 1]);
    const s = logitSlopes(w, t + 0.5);
    const k = pm * (1 - pm);
    let sum = 0;
    const teamGain = { 1: 0, [-1]: 0 };
    const own = new Array(10);
    for (let i = 0; i < 10; i++) {
      const p = od.players[i];
      const dg = p.gold_t[t + 1] - p.gold_t[t];
      const dx = p.xp_t[t + 1] - p.xp_t[t];
      // Quanto o que ELE ganhou empurrou a probabilidade do proprio time.
      own[i] = k * (s.gold * dg + s.xp * dx);
      teamGain[side[i]] += own[i];
      sum += side[i] * own[i];
    }
    linResidualAbs += Math.abs(P[t + 1] - P[t] - sum);
    // SEM escala para fechar a conta. Testado em 2026-11-21: escalar o minuto por
    // (variacao real / soma linear) explode quando a soma linear fica perto de zero, e a
    // referencia virou ruido (correlacao com o IMP de 0,32 para 0,08). O residuo fica no
    // diagnostico, e a soma do time erra por ele (~0,08 de probabilidade por partida).
    for (let i = 0; i < 10; i++) contrib[i] += own[i] - teamGain[-side[i]] / 5;
  }

  return { contrib, diag: { totalAbs, fightAbs, linResidualAbs, minutes: T } };
}

module.exports = { wpFeatures, logitSlopes, fitLogistic, wpRows, wpSeries, attributable, attribute, sigmoid, dot };
