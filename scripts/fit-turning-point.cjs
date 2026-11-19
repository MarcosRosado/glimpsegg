/**
 * Ajuste do piso de VIRADA (`TURNING_POINT_MODEL` em `src/utils/matchMetrics/turningPoint.ts`).
 *
 *   node scripts/fit-turning-point.cjs          distribuicao, piso por taxa e paridade com o app
 *   node scripts/fit-turning-point.cjs --json   so o bloco para colar em TURNING_POINT_MODEL
 *
 * A REGRA, fixada antes de olhar qualquer numero: "virada" é a partida em que o vencedor esteve
 * atras em ouro por pelo menos o piso, e o piso é o quantil que faz o rotulo disparar em 10% das
 * partidas — o meio do alvo de 5% a 15% que o projeto usa para tag (ver os limiares do
 * `MatchList` e do `awardEngine`). Nao ha gabarito para "virada": o que se controla é a taxa,
 * para o rotulo nao virar ruido (588 de ouro aos 2 minutos nao é virada) nem sumir.
 *
 * Fonte: `radiant_gold_adv` da metade OpenDota dos pares de 7.41 e 7.42, as duas juntas (o
 * deficit é sobre a partida inteira e nao muda de natureza entre patches; o script imprime a
 * taxa de cada patch com o piso escolhido, para conferir).
 *
 * A medida passa pela FUNCAO DO APP (`turningPoint`, carregada pelo `runnerImport` do Vite),
 * nao por uma copia — e confere, partida a partida, que o deficit dela bate com o calculado
 * aqui do cru e com o `comeback`/`throw` da OpenDota quando eles vem.
 *
 * Totalmente offline: le `.gabarito/pairs/`. Rodar da raiz, ou de um RETRATO CONGELADO (ver
 * scripts/CLAUDE.md) com GLIMPSE_ROOT apontando para o repo.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pathToFileURL } = require('url');

const DIR = path.join(process.cwd(), '.gabarito', 'pairs');
const TARGET_RATE = 0.1;
const PATCH_NAME = { 60: '7.41', 61: '7.42' };

function load() {
  const out = [];
  let files = [];
  try {
    files = fs.readdirSync(DIR).filter((n) => n.endsWith('.json.gz'));
  } catch {
    // tratado abaixo
  }
  for (const name of files) {
    let p;
    try {
      p = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, name))).toString('utf-8'));
    } catch {
      continue;
    }
    const od = p.od;
    if (!od || !Array.isArray(od.radiant_gold_adv) || od.radiant_gold_adv.length === 0) continue;
    out.push(od);
  }
  return out;
}

(async () => {
  const matches = load();
  if (matches.length < 200) {
    console.log(`partidas insuficientes: ${matches.length}. Rode scripts/collect-pairs.cjs.`);
    process.exit(1);
  }

  const root = process.env.GLIMPSE_ROOT || path.resolve(__dirname, '..');
  const vite = await import(pathToFileURL(require.resolve('vite', { paths: [root] })).href);
  const { module: mod } = await vite.runnerImport(path.join(root, 'src/utils/matchMetrics/turningPoint.ts'), { configFile: false, root });

  const rows = [];
  let mismatch = 0;
  let odChecked = 0;
  let odMismatch = 0;
  for (const od of matches) {
    const timeline = od.radiant_gold_adv.map((g, minute) => ({ minute, goldAdvantage: g, experienceAdvantage: 0 }));
    const tp = mod.turningPoint(timeline, !!od.radiant_win);
    const sign = od.radiant_win ? 1 : -1;
    const rawDeficit = Math.max(0, ...od.radiant_gold_adv.map((g) => -sign * g));
    const appDeficit = tp ? tp.maxDeficit : 0;
    if (appDeficit !== rawDeficit) mismatch++;
    const odField = typeof od.comeback === 'number' ? od.comeback : typeof od.throw === 'number' ? od.throw : null;
    // Quando o vencedor nunca esteve atras, a OpenDota manda a MENOR vantagem dele com o sinal
    // trocado (`throw: -100`): o deficit é 0, e é so isso que se compara.
    if (odField !== null) {
      odChecked++;
      if (Math.max(0, odField) !== rawDeficit) odMismatch++;
    }
    rows.push({ patch: PATCH_NAME[od.patch] || String(od.patch), deficit: rawDeficit });
  }

  const sorted = rows.map((r) => r.deficit).sort((a, b) => a - b);
  // Piso = menor deficit que deixa no maximo TARGET_RATE das partidas acima ou igual.
  const idx = Math.min(sorted.length - 1, Math.ceil((1 - TARGET_RATE) * sorted.length));
  const minDeficit = Math.round(sorted[idx] / 100) * 100;
  const rate = (rs) => rs.filter((r) => r.deficit >= minDeficit).length / rs.length;
  const measuredRate = Number(rate(rows).toFixed(3));

  const block = {
    fittedAt: new Date().toISOString().slice(0, 10),
    matches: rows.length,
    targetRate: TARGET_RATE,
    measuredRate,
    minDeficit,
  };
  if (process.argv.includes('--json')) return console.log(JSON.stringify(block, null, 2));

  const q = (x) => sorted[Math.min(sorted.length - 1, Math.floor(x * sorted.length))];
  console.log(`VIRADA — ${rows.length} partidas com serie de vantagem`);
  console.log(`  vencedor nunca atras: ${sorted.filter((d) => d === 0).length}`);
  console.log(`  deficit maximo do vencedor: p50 ${q(0.5)} | p75 ${q(0.75)} | p85 ${q(0.85)} | p90 ${q(0.9)} | p95 ${q(0.95)}`);
  console.log(`  piso para ${100 * TARGET_RATE}% de disparo: ${minDeficit} de ouro => dispara em ${(100 * measuredRate).toFixed(1)}%`);
  for (const p of [...new Set(rows.map((r) => r.patch))].sort()) {
    const rs = rows.filter((r) => r.patch === p);
    console.log(`    ${p}: ${(100 * rate(rs)).toFixed(1)}% de ${rs.length}`);
  }
  console.log(`  funcao do app x cru: ${rows.length - mismatch}/${rows.length} partidas com o mesmo deficit${mismatch ? '  <= DIVERGE' : ''}`);
  console.log(`  cru x comeback/throw da OpenDota (negativo = nunca atras = 0): ${odChecked - odMismatch}/${odChecked} onde o campo veio`);
  const app = mod.TURNING_POINT_MODEL;
  console.log(`  no app: minDeficit ${app.minDeficit} => ${app.minDeficit === minDeficit ? 'igual a este ajuste' : 'DIFERENTE — cole o bloco do --json'}`);
})();
