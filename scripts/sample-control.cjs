/**
 * Controle e slow SOFRIDOS por jogador — a amostra que calibra `matchupThreatLockdown`
 * e os arquetipos `HARD_LOCKDOWN`/`SLOW_KITE`. So a STRATZ mede isso
 * (`heroDamageReport.receivedTotal`); a OpenDota so tem `stuns` causados. É uma das
 * perdas sem volta do §2 de docs/PLANO-OPENDOTA.md, entao esta amostra é a ultima regua.
 *
 *   node scripts/sample-control.cjs collect     baixa a amostra (rede + token)
 *   node scripts/sample-control.cjs [arquivo]   so a distribuicao e as taxas de disparo
 *
 * `collect` grava um arquivo NOVO e datado, `.gabarito/control-sample-AAAA-MM-DD.json`
 * (fora do git); nunca sobrescreve nem grava vazio. O relatorio le o arquivo passado ou
 * o mais recente. O token nunca é impresso.
 * Rodar da raiz.
 */
const fs = require('fs');
const path = require('path');
const { requireToken, sleep, stratz, openDota, readJson, newSnapshotPath, latestSnapshotPath } = require('./lib/sources.cjs');

/** Faixas de `rank_tier` medio pedidas ao `/publicMatches`, para variar o ranque. */
const RANK_BANDS = [[10, 35], [36, 55], [56, 75], [76, 85]];
const PER_BAND = 60;

async function collect() {
  const token = requireToken();
  const ids = new Map();
  for (const [lo, hi] of RANK_BANDS) {
    try {
      const rows = await openDota(`publicMatches?min_rank=${lo}&max_rank=${hi}`);
      for (const r of rows.slice(0, PER_BAND)) ids.set(r.match_id, r.avg_rank_tier);
    } catch (e) {
      console.log(`publicMatches ${lo}-${hi}: ${e.message}`);
    }
    await sleep(1200);
  }
  console.log('ids candidatos:', ids.size);

  const out = [];
  const list = [...ids.keys()];
  for (let i = 0; i < list.length; i += 5) {
    const chunk = list.slice(i, i + 5);
    const q = 'query{' + chunk.map((id, k) =>
      `m${k}: match(id:${id}){ id durationSeconds parsedDateTime players{ heroId position isRadiant
        stats{ heroDamageReport{ receivedTotal{ stunCount stunDuration disableCount disableDuration slowCount slowDuration } } } } }`,
    ).join(' ') + '}';
    try {
      const data = await stratz(token, q);
      for (const m of Object.values(data || {})) {
        if (!m || m.players.length !== 10) continue;
        // So partida com o relatorio nos dez: a razao é contra a media da PARTIDA.
        if (!m.players.every((p) => p.stats?.heroDamageReport?.receivedTotal)) continue;
        out.push({
          id: m.id,
          rank: ids.get(m.id),
          dur: m.durationSeconds,
          players: m.players.map((p) => ({ h: p.heroId, pos: p.position, rad: p.isRadiant, ...p.stats.heroDamageReport.receivedTotal })),
        });
      }
    } catch (e) {
      console.log(`lote ${i}: ${e.message}`);
      await sleep(5000);
    }
    await sleep(700);
  }
  if (out.length === 0) {
    console.log('nenhuma partida com relatorio completo: nada foi gravado.');
    return null;
  }
  const file = newSnapshotPath('control-sample');
  fs.writeFileSync(file, JSON.stringify(out));
  console.log('partidas com relatorio completo:', out.length, '->', path.relative(process.cwd(), file));
  return file;
}

const q = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

function report(explicitFile) {
  const file = latestSnapshotPath('control-sample', explicitFile);
  const ms = file ? readJson(file, null) : null;
  if (!Array.isArray(ms) || ms.length === 0) {
    console.log('Sem amostra em .gabarito/control-sample-*.json. Rode: node scripts/sample-control.cjs collect');
    process.exit(1);
  }
  console.log('amostra:', path.relative(process.cwd(), file));
  const rows = [];
  for (const m of ms) {
    const min = m.dur / 60;
    const C = m.players.map((p) => p.stunDuration + p.disableDuration);
    const S = m.players.map((p) => p.slowDuration);
    const mc = C.reduce((a, b) => a + b, 0) / 10;
    const msl = S.reduce((a, b) => a + b, 0) / 10;
    m.players.forEach((p, i) => rows.push({
      id: m.id,
      cr: mc > 0 ? C[i] / mc : null,
      n: p.stunCount + p.disableCount,
      npm: (p.stunCount + p.disableCount) / min,
      sr: msl > 0 ? S[i] / msl : null,
      sn: p.slowCount,
      snpm: p.slowCount / min,
      pos: p.pos || 'UNKNOWN',
    }));
  }
  const byBand = ms.reduce((a, m) => { const k = Math.floor((m.rank || 0) / 10); a[k] = (a[k] || 0) + 1; return a; }, {});
  console.log(`jogadores: ${rows.length} | partidas: ${ms.length} | por medalha (tier): ${JSON.stringify(byBand)} | duracao min p10/p50/p90: ${[0.1, 0.5, 0.9].map((p) => q(ms.map((m) => m.dur / 60), p).toFixed(0)).join('/')}`);
  const pr = (name, arr) => console.log(name, 'p10/p25/p50/p75/p90/p95:', [0.1, 0.25, 0.5, 0.75, 0.9, 0.95].map((p) => q(arr, p).toFixed(2)).join(' / '));
  pr('razao controle ', rows.filter((r) => r.cr !== null).map((r) => r.cr));
  pr('controles/min  ', rows.map((r) => r.npm));
  pr('controles (n)  ', rows.map((r) => r.n));
  pr('razao slow     ', rows.filter((r) => r.sr !== null).map((r) => r.sr));
  pr('slows/min      ', rows.map((r) => r.snpm));
  pr('slows (n)      ', rows.map((r) => r.sn));

  console.log('\ncontrole: taxa de disparo (jogadores) e partidas com ao menos um disparo');
  for (const th of [1.4, 1.5, 1.6, 1.75, 2.0]) {
    for (const fl of [0, 0.5, 0.75, 1.0]) {
      const f = rows.filter((r) => r.cr !== null && r.cr > th && r.npm >= fl);
      const byPos = f.reduce((a, r) => { const k = r.pos.slice(-1); a[k] = (a[k] || 0) + 1; return a; }, {});
      console.log(`  razao>${th} piso ${fl}/min: ${((100 * f.length) / rows.length).toFixed(1)}% | partidas ${new Set(f.map((r) => r.id)).size}/${ms.length} | por posicao ${JSON.stringify(byPos)}`);
    }
  }
  console.log('\nslow:');
  for (const th of [1.5, 1.75, 2.0, 2.5]) {
    for (const fl of [0, 1, 2, 3]) {
      const f = rows.filter((r) => r.sr !== null && r.sr > th && r.snpm >= fl);
      console.log(`  razao>${th} piso ${fl}/min: ${((100 * f.length) / rows.length).toFixed(1)}% | partidas ${new Set(f.map((r) => r.id)).size}/${ms.length}`);
    }
  }
}

(async () => {
  if (process.argv[2] === 'collect') {
    const file = await collect();
    if (file) report(file);
  } else {
    report(process.argv[2]);
  }
})().catch((e) => {
  console.log('erro:', e.message);
  process.exit(1);
});
