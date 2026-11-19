/**
 * OpenDota x STRATZ nas MESMAS partidas — a tabela do §1 de docs/PLANO-OPENDOTA.md.
 *
 *   node scripts/compare-sources.cjs collect [conta ...]   baixa os pares (rede + token)
 *   node scripts/compare-sources.cjs [arquivo]             so o relatorio, offline
 *
 * `collect` grava um arquivo NOVO e datado, `.gabarito/pairs-AAAA-MM-DD.json` (fora do
 * git), e nunca sobrescreve coleta anterior nem grava resultado vazio. O relatorio le o
 * arquivo passado ou, sem ele, o mais recente; `pairs-2026-11-19.json` é a coleta que
 * produziu a tabela do plano. Sem argumentos o `collect` usa as tres contas
 * publicas de jogador profissional da medicao original — a amostra é pequena e enviesada
 * de proposito declarado (Immortal, mais de 20 minutos): serve para dizer o que é
 * viavel, nao para fixar limiar. A amostra estratificada é do `collect-pairs.cjs`.
 *
 * O token da STRATZ nunca é impresso (ver scripts/lib/sources.cjs). Rodar da raiz.
 */
const fs = require('fs');
const path = require('path');
const { requireToken, sleep, stratz, openDota, readJson, newSnapshotPath, latestSnapshotPath } = require('./lib/sources.cjs');

const DEFAULT_ACCOUNTS = [1260737963, 1100380463, 1131601207];
const MAX_MATCHES = 45;

/** Campos do jogador da OpenDota guardados no par. As series entram so no minuto 10. */
const OD_KEEP = [
  'player_slot', 'hero_id', 'isRadiant', 'position_est', 'lane', 'lane_role', 'is_roaming',
  'lane_efficiency', 'kills', 'deaths', 'assists', 'gold_per_min', 'xp_per_min', 'hero_damage',
  'tower_damage', 'hero_healing', 'net_worth', 'last_hits', 'denies', 'stuns',
  'teamfight_participation', 'camps_stacked', 'obs_placed', 'sen_placed', 'rank_tier',
  'benchmarks', 'damage_taken', 'damage_inflictor_received', 'life_state_dead',
  'item_0', 'item_1', 'item_2', 'item_3', 'item_4', 'item_5', 'item_neutral',
];

const STRATZ_MATCH_FIELDS = `durationSeconds parsedDateTime topLaneOutcome midLaneOutcome bottomLaneOutcome
  players{ playerSlot heroId isRadiant imp position lane role kills deaths assists goldPerMinute
    heroDamage networth item0Id item1Id item2Id item3Id item4Id item5Id neutral0Id
    stats{ deathEvents{ time isBurst }
      heroDamageReport{ receivedTotal{ physicalDamage magicalDamage pureDamage stunCount disableCount } }
      wards{ time type } } }`;

async function collect(accounts) {
  const token = requireToken();
  const ids = new Set();
  for (const acc of accounts) {
    try {
      const ms = await openDota(`players/${acc}/matches?limit=40&significant=0`);
      // Parseada na OpenDota, mais de 20 min, All Pick ranqueado.
      for (const m of ms) if (m.version != null && m.duration > 1200 && m.game_mode === 22) ids.add(m.match_id);
    } catch (e) {
      console.log(`conta ${acc}: ${e.message}`);
    }
    await sleep(1100);
  }
  console.log('candidatas parseadas na OpenDota (>20 min, All Pick ranqueado):', ids.size);

  const out = [];
  for (const id of [...ids].slice(0, MAX_MATCHES)) {
    try {
      const o = await openDota(`matches/${id}`);
      await sleep(1050);
      if (!o.players?.[0]?.gold_t) continue;
      const s = (await stratz(token, `query{ match(id:${id}){ ${STRATZ_MATCH_FIELDS} } }`))?.match;
      if (!s || !s.parsedDateTime) continue;
      out.push({
        id,
        dur: o.duration,
        radiant_win: o.radiant_win,
        stomp: o.stomp,
        comeback: o.comeback,
        od: o.players.map((p) => ({
          ...Object.fromEntries(OD_KEEP.map((k) => [k, p[k]])),
          g10: p.gold_t?.[10],
          nw10: p.networth_t?.[10],
          x10: p.xp_t?.[10],
          lh10: p.lh_t?.[10],
          deaths_log: p.deaths_log,
          kills_log: p.kills_log,
          obs_log: p.obs_log,
          obs_left_log: p.obs_left_log,
          sen_log: p.sen_log,
        })),
        st: s,
      });
    } catch (e) {
      console.log(id, e.message);
      await sleep(3000);
    }
  }
  if (out.length === 0) {
    console.log('nenhum par completo: nada foi gravado.');
    return null;
  }
  const file = newSnapshotPath('pairs');
  fs.writeFileSync(file, JSON.stringify(out));
  console.log('pares completos:', out.length, '->', path.relative(process.cwd(), file));
  return file;
}

/** Baselines do app (kp, kda), lidas do proprio arquivo para a formula nao divergir. */
function readBaselines() {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/constants/baselines.ts'), 'utf8');
  const BL = {};
  for (const m of src.matchAll(/(POSITION_\d|UNKNOWN): \{([\s\S]*?)\n {2}\}/g)) {
    const g = (k) => Number((m[2].match(new RegExp(k + ': ([\\d.]+)')) || [])[1]);
    BL[m[1]] = { kp: g('killParticipationPct'), kda: g('kda') };
  }
  return BL;
}

const corr = (a, b) => {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let s = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) {
    s += (a[i] - ma) * (b[i] - mb);
    sa += (a[i] - ma) ** 2;
    sb += (b[i] - mb) ** 2;
  }
  return s / Math.sqrt(sa * sb);
};
const rank = (a) => {
  const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
  const r = [];
  idx.forEach(([, i], k) => (r[i] = k));
  return r;
};
const median = (a) => [...a].sort((x, y) => x - y)[a.length >> 1];
const pct = (n, d) => (d ? ((100 * n) / d).toFixed(0) + '%' : 'n/d');

function report(explicitFile) {
  const file = latestSnapshotPath('pairs', explicitFile);
  const pairs = file ? readJson(file, null) : null;
  if (!Array.isArray(pairs) || pairs.length === 0) {
    console.log('Sem pares em .gabarito/pairs-*.json. Rode: node scripts/compare-sources.cjs collect');
    process.exit(1);
  }
  console.log('amostra:', path.relative(process.cwd(), file));
  const BL = readBaselines();

  let posOk = 0, posN = 0, posCoreSup = 0;
  const conf = {};
  const imp = [], custom = [], bench = [], absErr = [];
  let mvpSame = 0, mvpN = 0, signSame = 0;
  const laneRows = [];
  const physS = [], physO = [];
  let deathEq = 0, deathN = 0, wardEq = 0, wardN = 0, wardDiff = 0;
  // Aceite da Fase 1: campos que tem de ser IDENTICOS entre as duas fontes.
  const same = { kda: [0, 0], networth: [0, 0], items: [0, 0] };

  for (const m of pairs) {
    const sBy = new Map(m.st.players.map((p) => [p.playerSlot, p]));
    const teamKills = { true: 0, false: 0 };
    for (const p of m.st.players) teamKills[p.isRadiant] += p.kills;
    const mi = [], mc = [];
    for (const o of m.od) {
      const s = sBy.get(o.player_slot);
      if (!s) continue;

      // 1. posicao
      if (s.position && o.position_est) {
        posN++;
        const sp = Number(s.position.slice(-1));
        if (sp === o.position_est) posOk++;
        if (sp <= 3 === o.position_est <= 3) posCoreSup++;
        const k = sp + '>' + o.position_est;
        conf[k] = (conf[k] || 0) + 1;
      }

      // 3. IMP: a formula que o app usava (`calculateCustomImp`, apagada em 2026-11-19) contra o IMP real
      if (typeof s.imp === 'number') {
        const b = BL[s.position || 'UNKNOWN'] || BL.UNKNOWN;
        const dur = Math.max(15, m.dur / 60);
        const kp = teamKills[s.isRadiant] > 0 ? ((s.kills + s.assists) / teamKills[s.isRadiant]) * 100 : 50;
        const kda = s.deaths === 0 ? (s.kills + s.assists) * 1.2 : (s.kills + s.assists) / s.deaths;
        const c = Math.max(-50, Math.min(50, Math.round(
          ((kp - b.kp) / 20) * 8 + ((s.heroDamage / dur - 700) / 350) * 8 + (4.5 - s.deaths) * 2.2 +
          ((s.goldPerMinute - 650) / 100) * 3 + (kda - b.kda) * 2,
        )));
        imp.push(s.imp);
        custom.push(c);
        absErr.push(Math.abs(c - s.imp));
        mi.push(s.imp);
        mc.push(c);
        if (Math.sign(c) === Math.sign(s.imp)) signSame++;
        const bm = o.benchmarks || {};
        const pc = ['gold_per_min', 'xp_per_min', 'kills_per_min', 'last_hits_per_min', 'hero_damage_per_min', 'hero_healing_per_min', 'tower_damage']
          .map((k) => bm[k]?.pct)
          .filter((v) => typeof v === 'number');
        bench.push(pc.length ? pc.reduce((a, b2) => a + b2, 0) / pc.length : 0.5);
      }

      // 4. dano fisico: fatia fisica da STRATZ x fatia de ataque basico da OpenDota
      const rt = s.stats?.heroDamageReport?.receivedTotal;
      if (rt && o.damage_inflictor_received) {
        const tot = rt.physicalDamage + rt.magicalDamage + rt.pureDamage;
        const oTot = Object.values(o.damage_inflictor_received).reduce((a, b2) => a + b2, 0);
        if (tot > 0 && oTot > 0) {
          physS.push(rt.physicalDamage / tot);
          physO.push((o.damage_inflictor_received['null'] || 0) / oTot);
        }
      }

      // 5. mortes e wards
      const sd = s.stats?.deathEvents?.length ?? null;
      if (sd !== null) {
        deathN++;
        if (sd === (o.deaths_log?.length ?? -1)) deathEq++;
      }
      const sw = s.stats?.wards?.length ?? null;
      if (sw !== null) {
        wardN++;
        const ow = (o.obs_log?.length || 0) + (o.sen_log?.length || 0);
        if (sw === ow) wardEq++;
        wardDiff += Math.abs(sw - ow);
      }

      // Aceite da Fase 1
      same.kda[1]++;
      if (s.kills === o.kills && s.deaths === o.deaths && s.assists === o.assists) same.kda[0]++;
      if (typeof s.networth === 'number' && typeof o.net_worth === 'number') {
        same.networth[1]++;
        if (s.networth === o.net_worth) same.networth[0]++;
      }
      if ('item0Id' in s && 'item_0' in o && o.item_0 !== undefined) {
        same.items[1]++;
        const a = [s.item0Id, s.item1Id, s.item2Id, s.item3Id, s.item4Id, s.item5Id].map((v) => v || 0).sort().join();
        const b2 = [o.item_0, o.item_1, o.item_2, o.item_3, o.item_4, o.item_5].map((v) => v || 0).sort().join();
        if (a === b2) same.items[0]++;
      }
    }
    if (mi.length === 10) {
      mvpN++;
      if (mi.indexOf(Math.max(...mi)) === mc.indexOf(Math.max(...mc))) mvpSame++;
    }

    // 2. rota: patrimonio aos 10 min de quem estava na rota (lane OD: 1 bot, 2 mid, 3 top)
    for (const [lane, key] of [[1, 'bottomLaneOutcome'], [2, 'midLaneOutcome'], [3, 'topLaneOutcome']]) {
      const out = m.st[key];
      if (!out) continue;
      const side = (rad) => m.od.filter((p) => p.lane === lane && p.isRadiant === rad).reduce((a, p) => a + (p.nw10 ?? p.g10 ?? 0), 0);
      const r = side(true), d = side(false);
      if (!r || !d) continue;
      laneRows.push({ out, rel: (r - d) / ((r + d) / 2) });
    }
  }

  console.log(`partidas ${pairs.length} | jogadores com IMP ${imp.length}`);
  console.log(`\n1 POSICAO  position_est == position da STRATZ: ${posOk}/${posN} (${pct(posOk, posN)}) | core/suporte igual: ${pct(posCoreSup, posN)}`);
  console.log('  confusoes:', JSON.stringify(Object.fromEntries(Object.entries(conf).filter(([k]) => k[0] !== k[2]))));

  console.log(`\n2 ROTA  rotas com outcome e patrimonio dos dois lados: ${laneRows.length}`);
  const cls = (o) => (/RADIANT/.test(o) ? 1 : /DIRE/.test(o) ? -1 : 0);
  for (const th of [0.05, 0.08, 0.1, 0.15]) {
    let ok = 0;
    for (const r of laneRows) if ((r.rel > th ? 1 : r.rel < -th ? -1 : 0) === cls(r.out)) ok++;
    console.log(`  empate se |dif relativa| < ${th}: direcao igual ${pct(ok, laneRows.length)}`);
  }
  const by = {};
  for (const r of laneRows) (by[r.out] = by[r.out] || []).push(r.rel);
  for (const [k, v] of Object.entries(by)) {
    console.log(`  ${k.padEnd(16)} n=${v.length} dif relativa min/med/max ${Math.min(...v).toFixed(2)} ${median(v).toFixed(2)} ${Math.max(...v).toFixed(2)}`);
  }

  if (imp.length) {
    console.log(`\n3 IMP  formula do app x IMP real: r=${corr(imp, custom).toFixed(2)} | spearman=${corr(rank(imp), rank(custom)).toFixed(2)} | erro abs medio=${(absErr.reduce((a, b) => a + b, 0) / absErr.length).toFixed(1)} | mesmo sinal=${pct(signSame, imp.length)} | mesmo melhor da partida=${mvpSame}/${mvpN}`);
    console.log(`  IMP real min/med/max ${Math.min(...imp)} ${median(imp)} ${Math.max(...imp)} | formula min/med/max ${Math.min(...custom)} ${median(custom)} ${Math.max(...custom)} | saturados em +-50: ${custom.filter((c) => Math.abs(c) === 50).length}`);
    console.log(`  media dos percentis de benchmark da OpenDota x IMP real: r=${corr(imp, bench).toFixed(2)} | spearman=${corr(rank(imp), rank(bench)).toFixed(2)}`);
    console.log(`  partidas com IMP nos 10 jogadores: ${mvpN}/${pairs.length}`);
  }

  if (physS.length) {
    console.log(`\n4 DANO  fatia fisica (STRATZ) x fatia de ataque basico (OpenDota): r=${corr(physS, physO).toFixed(2)} | dif abs media ${((physS.reduce((a, v, i) => a + Math.abs(v - physO[i]), 0) / physS.length) * 100).toFixed(1)} pp | n=${physS.length}`);
  }
  console.log(`\n5 MORTES mesma contagem: ${deathEq}/${deathN} | WARDS mesma contagem: ${wardEq}/${wardN} (dif media ${(wardDiff / Math.max(1, wardN)).toFixed(2)})`);

  const line = (label, [ok, n]) => `${label} ${n ? `${ok}/${n}` : 'n/d (recolher os pares)'}`;
  // Campo cru contra campo cru: mede se as FONTES concordam, nao o `mapOpenDotaMatch`.
  console.log(`\nFONTES IDENTICAS (insumo do aceite da Fase 1)  ${line('KDA', same.kda)} | ${line('patrimonio final', same.networth)} | ${line('itens', same.items)} | posicao ${pct(posOk, posN)} (minimo 95%)`);
}

(async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'collect') {
    const accounts = rest.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0);
    const file = await collect(accounts.length ? accounts : DEFAULT_ACCOUNTS);
    if (file) report(file);
  } else {
    report(cmd);
  }
})().catch((e) => {
  console.log('erro:', e.message);
  process.exit(1);
});
