/**
 * Coletor do gabarito — terceira tarefa da Fase 0 de docs/PLANO-OPENDOTA.md e a base de
 * dados da Fase 2. Roteiro de uso do dia a dia: docs/COLETA-GABARITO.md.
 *
 * Numa passada so sobre `/parsedMatches` ele grava DUAS coisas:
 *
 *  - PARES rotulados OpenDota x STRATZ, estratificados (`.gabarito/pairs/`): a mesma partida
 *    com a resposta crua da OpenDota de um lado e `imp`, `position`, outcomes de rota e os
 *    insumos do IMP da STRATZ do outro. Amostra de ajuste e validacao das Fases 1, 3 e 4.
 *  - VOLUME so-OpenDota (`.gabarito/matches/`): a partida que passou na triagem mas caiu em
 *    celula de par ja cheia. Sem rotulo da STRATZ, custa UMA chamada, e é a materia-prima
 *    dos benchmarks proprios (Fase 2) e do criterio de corte continuo.
 *
 *   node scripts/collect-pairs.cjs                         trilha 7.42 (retoma de onde parou)
 *   node scripts/collect-pairs.cjs --lane 7.41 --before <matchId>   abre a trilha 7.41
 *   node scripts/collect-pairs.cjs --lane 7.41             retoma a trilha 7.41
 *   node scripts/collect-pairs.cjs --limit 20              para depois de 20 gravacoes (teste curto)
 *   node scripts/collect-pairs.cjs --no-volume             so pares; celula cheia é pulada sem custo
 *   node scripts/collect-pairs.cjs --reserve 1500          para quando o saldo do dia chegar em 1.500
 *                                                          (é como `collect-daily.sh` deixa a cota do app)
 *   node scripts/collect-pairs.cjs --status                tabelas de estrato, sem rede
 *
 * ESTRATOS. 5 faixas de ranque x 3 de duracao (< 25, 25–40, > 40 min), POR PATCH. Meta: 50
 * pares por celula; teto de 90. O teto é por patch porque o §5 do plano pede ajuste em 7.41
 * e teste em 7.42: com teto unico, as celulas comuns enchiam de 7.42 (a lista vem do mais
 * novo para o mais velho) e toda partida de 7.41 cairia em `celula_cheia`.
 *
 * TRILHAS. `/parsedMatches` é paginada por id decrescente, entao cada patch tem o seu
 * cursor. A 7.42 comeca do topo; a 7.41 comeca de `--before`, um id logo acima da virada
 * (achado por bissecao no horario de inicio, em 2026-11-19: 9095964639). Partida do outro
 * patch é pulada pela triagem, sem custo. O patch vem da OpenDota — ver `PATCH_BY_OD_ID`.
 *
 * ORCAMENTO. Sem chave, a OpenDota da 3.000 chamadas por dia e 60 por minuto, e
 * `/parsedMatches` so lista ids. A pagina inteira (100 ids) passa antes por UMA consulta
 * requisicao a STRATZ (cem `match(id)` com alias), que diz modo, parse, duracao, ranque e
 * horario: sem triagem, nas primeiras 544 candidatas, 317 (58%) gastaram a chamada e cairam
 * em `modo`. Se a triagem falhar, o script segue sem ela (mais caro, mesmo resultado). Ele
 * para sozinho quando o dia chega em `DAY_RESERVE` chamadas e retoma no dia seguinte.
 *
 * Um coletor por vez: duas instancias regravariam o mesmo `index.json` uma por cima da
 * outra. `.gabarito/pairs/.lock` guarda o pid e a segunda instancia se recusa a rodar.
 *
 * O token da STRATZ nunca é impresso. Rodar da raiz.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { DATA_DIR, dataPath, requireToken, sleep, stratz, openDota, openDotaBudget, readJson } = require('./lib/sources.cjs');

const TARGET_PER_CELL = 50;
const CELL_CAP = 90;
/** Chamadas do dia deixadas para o proprio app e para os outros scripts. */
const DAY_RESERVE = 150;
/** Uma chamada por segundo fica abaixo das 60 por minuto. */
const OD_INTERVAL_MS = 1100;

/**
 * Intervalo minimo entre dois PARES gravados. Cada par custa duas consultas a STRATZ (a
 * partida e o gerador do IMP), e com a triagem quase toda candidata vira par: sem freio
 * seriam ~2.900 consultas por hora. O limite horario padrao do token individual é 2.000
 * (valor da documentacao da STRATZ, nao medido aqui); 4,5 s por par da ~1.600 por hora.
 */
const PAIR_INTERVAL_MS = 4500;

/** [min, max) sobre a MEDIA de `rank_tier`, que é fracionaria: 29,5 cai em HERALD_GUARDIAN. */
const RANK_BANDS = [
  ['HERALD_GUARDIAN', 10, 30],
  ['CRUSADER_ARCHON', 30, 50],
  ['LEGEND_ANCIENT', 50, 70],
  ['DIVINE', 70, 80],
  ['IMMORTAL', 80, 90],
];
const DURATION_BANDS = [
  ['LT25', 0, 25 * 60],
  ['25_40', 25 * 60, 40 * 60],
  ['GT40', 40 * 60, Infinity],
];

/** Pesados e sem uso em nenhuma fase do plano; o resto da resposta fica como veio. */
const OD_DROP_MATCH = ['chat', 'cosmetics', 'all_word_counts', 'my_word_counts', 'draft_timings', 'replay_url'];
const OD_DROP_PLAYER = ['cosmetics', 'lane_pos', 'obs', 'sen', 'actions', 'max_hero_hit', 'personaname', 'name', 'last_login'];

/**
 * Itens, mochila, neutro, cs/denies, nivel e `stats.wards` existem por causa do aceite da
 * Fase 1 (`accept-phase1.cjs`), que compara a saida do `mapOpenDotaMatch` com estes campos.
 * Os nomes sao os da consulta que o app usava (`services/stratzGql.ts`, apagado em 2026-11-19).
 * `stats.impPerMinute` (lido do schema) é a serie do IMP por minuto, insumo da Fase 4. Os
 * INSUMOS do IMP (`impValues`, `events`, `winChance`) vem de outra raiz —
 * `stratz.page.imp.matchGenerator` — e sao buscados numa segunda consulta, ver `GENERATOR_QUERY`.
 * Mexer aqui DEPOIS de comecar a coleta deixa pares antigos sem o campo novo: o aceite
 * tira esses pares do denominador e avisa, mas o certo é completar pela STRATZ por id.
 */
const STRATZ_FIELDS = `id durationSeconds startDateTime parsedDateTime gameVersionId lobbyType gameMode bracket actualRank
  analysisOutcome topLaneOutcome midLaneOutcome bottomLaneOutcome
  players{ playerSlot heroId isRadiant imp position lane role award kills deaths assists networth
    goldPerMinute heroDamage towerDamage heroHealing numLastHits numDenies level
    item0Id item1Id item2Id item3Id item4Id item5Id backpack0Id backpack1Id backpack2Id neutral0Id
    stats{ impPerMinute wards{ time type positionX positionY }
      deathEvents{ time isBurst isDieBack isAttemptTpOut }
      heroDamageReport{ receivedTotal{ physicalDamage magicalDamage pureDamage stunCount stunDuration disableCount disableDuration slowCount slowDuration } } } }`;

/** Erros seguidos que encerram a execucao (cada candidata ja custou uma chamada a OpenDota). */
const MAX_ERROR_STREAK = 5;

/**
 * Insumos do IMP por minuto, acertados por `probe-imp-generator.cjs` em 2026-11-19: dez
 * jogadores x minuto, na ordem dos jogadores da partida. Falha aqui NAO descarta o par
 * (fica `gen: null` e `hasGenerator: false` no indice): o gerador é insumo da Fase 4, e
 * da para completar depois so pela STRATZ, por id, sem gastar cota da OpenDota.
 */
const GENERATOR_QUERY = (id) => `{ stratz{ page{ imp{ matchGenerator(matchId:${id}){ winChance winRateByPlayerMinuteValues impValues
  events{ time kills deaths assists cs dn level physicalDamage magicalDamage pureDamage damageReceived healingAllies runePower neutrals } } } } } }`;

/**
 * O PATCH VEM DA OPENDOTA, NUNCA DA STRATZ. A STRATZ nao conhece o 7.42: `gameVersions` para
 * em 7.41f (id 190) e ela marca com 190 tanto partida de 11/11 quanto de 19/11 — separar por
 * `gameVersionId` poria tudo no mesmo saco (a primeira versao deste coletor fez isso, com
 * "190 = 7.42"). A OpenDota grava `patch` na partida (60 = 7.41, 61 = 7.42) e publica a
 * data da virada em `/constants/patch`: 7.42 em 2026-11-18T21:28:07Z. O registro usa o
 * `patch` da partida; a triagem, que ainda nao tem a partida, usa o horario de inicio.
 */
const PATCH_BY_OD_ID = { 60: '7.41', 61: '7.42' };
const PATCH_742_START = Date.parse('2026-11-18T21:28:07Z') / 1000;
const PATCHES = ['7.41', '7.42'];
const patchOfStart = (startDateTime) =>
  typeof startDateTime === 'number' ? (startDateTime >= PATCH_742_START ? '7.42' : '7.41') : null;
/** Par antigo nao tem `patch` no indice: os 213 colhidos antes das trilhas sao todos `patch` 61 (conferido). */
const patchOfEntry = (e) => e.patch || '7.42';
/** Uma pagina de ids por vez custa uma consulta a STRATZ: 2,5 s segura ~1.400 por hora. */
const PAGE_INTERVAL_MS = 2500;

const indexPath = path.join(DATA_DIR, 'pairs', 'index.json');
const indexFile = () => dataPath('pairs', 'index.json');
const lockPath = path.join(DATA_DIR, 'pairs', '.lock');
const cellKey = (patch, rank, dur) => `${patch}|${rank}|${dur}`;

function strata(avgRank, duration) {
  const rank = RANK_BANDS.find(([, lo, hi]) => avgRank >= lo && avgRank < hi)?.[0];
  const dur = DURATION_BANDS.find(([, lo, hi]) => duration >= lo && duration < hi)?.[0];
  return rank && dur ? { rank, dur } : null;
}

/** Indice antigo (antes das trilhas) nao tem `cursors` nem `volume`: completa sem perder nada. */
function loadIndex() {
  const index = readJson(indexPath, { pairs: {}, seen: 0, skipped: {}, cursor: null });
  index.cursors = index.cursors || {};
  if (index.cursor && !index.cursors['7.42']) index.cursors['7.42'] = index.cursor;
  index.volume = index.volume || {};
  // O patch do volume sai do `patch` da OpenDota guardado junto, nao do que a trilha achava.
  for (const e of Object.values(index.volume)) if (PATCH_BY_OD_ID[e.odPatch]) e.patch = PATCH_BY_OD_ID[e.odPatch];
  return index;
}

function counts(index) {
  const c = {};
  for (const e of Object.values(index.pairs)) {
    const k = cellKey(patchOfEntry(e), e.rank, e.dur);
    c[k] = (c[k] || 0) + 1;
  }
  return c;
}

function status(index) {
  const c = counts(index);
  const vals = Object.values(index.pairs);
  const vol = Object.values(index.volume);
  console.log(`pares: ${vals.length} | volume so-OpenDota: ${vol.length} | candidatas vistas: ${index.seen} | descartadas: ${JSON.stringify(index.skipped)}`);
  console.log(`com IMP nos 10 jogadores: ${vals.filter((e) => e.impCount === 10).length} | com as 3 rotas rotuladas: ${vals.filter((e) => e.laneOutcomes === 3).length} | com insumos do IMP (gerador): ${vals.filter((e) => e.hasGenerator).length}`);
  for (const patch of PATCHES) {
    const inPatch = vals.filter((e) => patchOfEntry(e) === patch).length;
    const volPatch = vol.filter((e) => e.patch === patch).length;
    console.log(`\nPATCH ${patch} — pares ${inPatch} | volume ${volPatch} | cursor ${index.cursors[patch] ?? 'trilha nao aberta'}`);
    console.log(' '.repeat(18) + DURATION_BANDS.map(([d]) => d.padStart(7)).join(''));
    let short = 0;
    for (const [rank] of RANK_BANDS) {
      const row = DURATION_BANDS.map(([dur]) => {
        const n = c[cellKey(patch, rank, dur)] || 0;
        if (n < TARGET_PER_CELL) short++;
        return String(n).padStart(7);
      });
      console.log(rank.padEnd(18) + row.join(''));
    }
    console.log(`celulas abaixo de ${TARGET_PER_CELL}: ${short}/15`);
  }
}

/** Trava de instancia unica. Pid morto (maquina reiniciada, kill -9) nao segura a trava. */
function acquireLock() {
  const held = Number(readJson(lockPath, {}).pid);
  if (held && held !== process.pid) {
    try {
      process.kill(held, 0);
      console.log(`ja existe um coletor rodando (pid ${held}). Um por vez: os dois regravariam o mesmo indice.`);
      process.exit(1);
    } catch {
      // processo nao existe mais: trava velha
    }
  }
  fs.writeFileSync(dataPath('pairs', '.lock'), JSON.stringify({ pid: process.pid, since: new Date().toISOString() }));
  process.on('exit', () => {
    try {
      if (Number(readJson(lockPath, {}).pid) === process.pid) fs.unlinkSync(lockPath);
    } catch {
      // nada a liberar
    }
  });
}

const argValue = (flag) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
};

(async () => {
  const index = loadIndex();
  if (process.argv.includes('--status')) return status(index);

  const lane = argValue('--lane') || '7.42';
  if (!PATCHES.includes(lane)) {
    console.log(`--lane aceita: ${PATCHES.join(', ')}`);
    process.exit(1);
  }
  const before = argValue('--before');
  if (before !== undefined) {
    if (!Number.isSafeInteger(Number(before)) || Number(before) <= 0) {
      console.log('uso: --before <matchId>');
      process.exit(1);
    }
    // `--before` so ABRE trilha. Sobre trilha ja aberta ele jogaria fora o cursor.
    if (index.cursors[lane]) console.log(`trilha ${lane} ja aberta no cursor ${index.cursors[lane]}: --before ignorado.`);
    else index.cursors[lane] = Number(before);
  }
  if (lane !== '7.42' && !index.cursors[lane]) {
    console.log(`a trilha ${lane} ainda nao foi aberta: passe --before <matchId> com um id logo acima da virada do patch.`);
    process.exit(1);
  }
  const limit = argValue('--limit') !== undefined ? Number(argValue('--limit')) : Infinity;
  if (!(limit > 0)) {
    console.log('uso: --limit <n gravacoes>');
    process.exit(1);
  }
  const keepVolume = !process.argv.includes('--no-volume');

  const token = requireToken();
  acquireLock();
  const skip = (why) => (index.skipped[why] = (index.skipped[why] || 0) + 1);
  const save = () => fs.writeFileSync(indexFile(), JSON.stringify(index));
  const reserve = argValue('--reserve') !== undefined ? Number(argValue('--reserve')) : DAY_RESERVE;
  if (!(reserve >= DAY_RESERVE)) {
    console.log(`uso: --reserve <n>, no minimo ${DAY_RESERVE}`);
    process.exit(1);
  }
  const budgetLeft = () => openDotaBudget.day === null || openDotaBudget.day > reserve;
  let added = 0;
  let addedPairs = 0;
  let addedVolume = 0;
  let lastPairAt = 0;
  // Uma sequencia por API: candidata descartada antes da STRATZ nao pode zerar a dela.
  const errorStreak = { od: 0, st: 0 };

  // A OpenDota é chamada ANTES da STRATZ em cada candidata. Um nome de campo errado em
  // STRATZ_FIELDS queimaria as 3.000 chamadas do dia em `erro`, com zero pares: valida a
  // consulta inteira primeiro, sem tocar a OpenDota.
  // Nome de campo errado é erro de validacao com QUALQUER id, entao nao ha id real cravado
  // aqui (id real em arquivo commitado desanonimiza fixture): usa um par ja colhido, ou 1.
  const preflightId = Number(Object.keys(index.pairs)[0]) || 1;
  const probe = (await stratz(token, `query{ match(id:${preflightId}){ ${STRATZ_FIELDS} } }`))?.match;
  const pp = probe?.players?.[0];
  console.log(`trilha ${lane} | cursor ${index.cursors[lane] ?? 'topo'} | volume ${keepVolume ? 'ligado' : 'desligado'}`);
  console.log(`consulta da STRATZ validada | partida de teste: ${probe ? 'respondeu' : 'nula (esperado sem par colhido)'}${pp ? ` | itens ${'item0Id' in pp ? 'ok' : 'AUSENTE'} | wards ${Array.isArray(pp.stats?.wards) ? 'ok' : 'nulo'} | imp ${typeof pp.imp}` : ''}`);

  let stop = false;
  process.on('SIGINT', () => {
    stop = true;
    console.log('\nparando depois da partida atual…');
  });
  process.on('SIGTERM', () => {
    stop = true;
  });

  /** Grava a partida como volume so-OpenDota. `o` ja esta enxuto e sem `account_id`. */
  const saveVolume = (id, o, cell, patch) => {
    fs.writeFileSync(dataPath('matches', `${id}.json.gz`), zlib.gzipSync(JSON.stringify({ id, od: o })));
    index.volume[id] = { rank: cell.rank, dur: cell.dur, patch, odPatch: o.patch ?? null };
    added += 1;
    addedVolume += 1;
  };
  const trim = (o) => {
    for (const k of OD_DROP_MATCH) delete o[k];
    for (const p of o.players) {
      for (const k of OD_DROP_PLAYER) delete p[k];
      // Nem o par nem o benchmark precisam saber quem jogou.
      p.account_id = null;
    }
  };
  const progress = () => {
    if (added > 0 && added % 10 === 0) {
      save();
      console.log(`  +${addedPairs} pares, +${addedVolume} volume | orcamento do dia na OpenDota: ${openDotaBudget.day ?? '?'}`);
    }
  };

  let lastPageAt = 0;
  let wrongPatchPages = 0;
  while (!stop && budgetLeft() && added < limit) {
    const c = counts(index);
    const allFull = RANK_BANDS.every(([r]) => DURATION_BANDS.every(([d]) => (c[cellKey(lane, r, d)] || 0) >= CELL_CAP));
    // Com volume ligado nao ha "cheio": celula cheia de par continua rendendo benchmark.
    if (allFull && !keepVolume) {
      console.log(`todas as celulas de ${lane} no teto de ${CELL_CAP}.`);
      break;
    }

    const pageWait = lastPageAt + PAGE_INTERVAL_MS - Date.now();
    if (pageWait > 0) await sleep(pageWait);
    lastPageAt = Date.now();
    let page;
    try {
      page = await openDota('parsedMatches' + (index.cursors[lane] ? `?less_than_match_id=${index.cursors[lane]}` : ''));
    } catch (e) {
      console.log('parsedMatches:', e.message);
      if (e.status === 429) break;
      await sleep(15000);
      continue;
    }
    if (!Array.isArray(page) || page.length === 0) {
      console.log('fim da lista de partidas parseadas.');
      break;
    }

    // Triagem da pagina pela STRATZ. `null` = triagem indisponivel, cai no caminho caro.
    let triage = null;
    try {
      const ids = page.map((m) => m.match_id).filter((n) => Number.isSafeInteger(n));
      // Cem `match(id)` com alias numa requisicao so. A raiz `matches(ids)` seria o natural,
      // mas responde `null` com "User is not an admin." — e a primeira versao, que a usava,
      // tratou esse `null` como "sem triagem" em silencio e rodou horas no caminho caro.
      const data = await stratz(token, `{ ${ids.map((id) => `m${id}: match(id:${id}){ id lobbyType gameMode durationSeconds parsedDateTime actualRank startDateTime }`).join(' ')} }`);
      const rows = Object.values(data || {}).filter(Boolean);
      if (rows.length) triage = new Map(rows.map((r) => [Number(r.id), r]));
      else console.log(`triagem pela STRATZ voltou vazia nesta pagina${stratz.lastErrors.length ? ': ' + stratz.lastErrors[0] : ''}`);
    } catch (e) {
      if (e.status === 429) { console.log('STRATZ no limite de chamadas: parando.'); break; }
      console.log('triagem pela STRATZ indisponivel nesta pagina:', e.message);
    }

    // A trilha 7.42 desce ate entrar no patch anterior; ali ela acabou. Tres paginas
    // seguidas sem nenhuma partida do patch da trilha encerram a execucao.
    if (triage && triage.size) {
      const mine = [...triage.values()].filter((t) => patchOfStart(t.startDateTime) === lane).length;
      wrongPatchPages = mine === 0 ? wrongPatchPages + 1 : 0;
      if (wrongPatchPages >= 3 && lane === '7.42') {
        console.log('a trilha 7.42 chegou ao patch anterior: nada mais a colher nela abaixo do ponto de partida.');
        index.cursors[lane] = page[page.length - 1].match_id;
        break;
      }
    }

    for (const { match_id: id } of page) {
      if (stop || !budgetLeft() || added >= limit) break;
      index.cursors[lane] = id;
      if (index.pairs[id] || index.volume[id]) continue;
      index.seen += 1;
      let wantPair = true;
      if (triage) {
        const t = triage.get(Number(id));
        if (!t || !t.parsedDateTime) { skip('stratz_sem_parse'); continue; }
        if (t.lobbyType !== 'RANKED' || t.gameMode !== 'ALL_PICK_RANKED') { skip('modo'); continue; }
        if (patchOfStart(t.startDateTime) !== lane) { skip('outro_patch'); continue; }
        // `actualRank` da STRATZ fica a poucos pontos da media de `rank_tier` (medido nos 15
        // primeiros pares: diferenca maxima de 3). Serve para decidir par ou volume antes de
        // pagar; o estrato GRAVADO continua saindo da OpenDota, abaixo.
        const approx = typeof t.actualRank === 'number' ? strata(t.actualRank, t.durationSeconds) : null;
        if (approx && (counts(index)[cellKey(lane, approx.rank, approx.dur)] || 0) >= CELL_CAP) {
          if (!keepVolume) { skip('celula_cheia'); continue; }
          wantPair = false;
        }
      }
      try {
        let o;
        try {
          o = await openDota(`matches/${id}`);
          errorStreak.od = 0;
        } catch (e) {
          errorStreak.od += 1;
          throw e;
        }
        await sleep(OD_INTERVAL_MS);
        const players = Array.isArray(o.players) ? o.players : [];
        if (players.length !== 10 || !players[0].networth_t) { skip('sem_series'); continue; }
        // So All Pick ranqueado: é onde ha medalha, IMP e outcome de rota comparaveis.
        if (o.game_mode !== 22 || o.lobby_type !== 7) { skip('modo'); continue; }
        const ranks = players.map((p) => p.rank_tier).filter((r) => typeof r === 'number' && r > 0);
        if (ranks.length < 5) { skip('sem_ranque'); continue; }
        const avgRank = ranks.reduce((a, b) => a + b, 0) / ranks.length;
        const cell = strata(avgRank, o.duration);
        if (!cell) { skip('fora_do_estrato'); continue; }
        // Patch de verdade: o da partida. Se nao é o da trilha (sem triagem, ou partida na
        // borda da virada), a chamada ja foi paga e ela vira volume do patch DELA.
        const patch = PATCH_BY_OD_ID[o.patch];
        if (!patch) { skip('patch_desconhecido'); continue; }
        if (patch !== lane) {
          skip('outro_patch');
          if (keepVolume) { trim(o); saveVolume(id, o, cell, patch); progress(); }
          continue;
        }
        // A chamada ja foi paga: celula cheia vira volume em vez de ir para o lixo.
        if ((counts(index)[cellKey(lane, cell.rank, cell.dur)] || 0) >= CELL_CAP) wantPair = false;
        if (!wantPair) {
          if (keepVolume) { trim(o); saveVolume(id, o, cell, lane); progress(); }
          else skip('celula_cheia');
          continue;
        }

        const wait = lastPairAt + PAIR_INTERVAL_MS - Date.now();
        if (wait > 0) await sleep(wait);
        lastPairAt = Date.now();
        let s;
        try {
          s = (await stratz(token, `query{ match(id:${id}){ ${STRATZ_FIELDS} } }`))?.match;
          errorStreak.st = 0;
        } catch (e) {
          errorStreak.st += 1;
          throw e;
        }
        await sleep(400);
        if (!s || !s.parsedDateTime) { skip('stratz_sem_parse'); continue; }

        let gen = null;
        try {
          gen = (await stratz(token, GENERATOR_QUERY(id)))?.stratz?.page?.imp?.matchGenerator ?? null;
        } catch (e) {
          if (e.status === 429) throw e;
          console.log(id, 'gerador do IMP:', e.message);
        }
        await sleep(400);

        trim(o);
        fs.writeFileSync(dataPath('pairs', `${id}.json.gz`), zlib.gzipSync(JSON.stringify({ id, od: o, st: s, gen })));
        index.pairs[id] = {
          rank: cell.rank,
          dur: cell.dur,
          avgRank: Math.round(avgRank),
          duration: o.duration,
          patch,
          gameVersionId: s.gameVersionId ?? null,
          impCount: s.players.filter((p) => typeof p.imp === 'number').length,
          laneOutcomes: ['top', 'mid', 'bottom'].filter((l) => s[`${l}LaneOutcome`]).length,
          hasGenerator: Array.isArray(gen?.impValues) && gen.impValues.length === 10,
        };
        added += 1;
        addedPairs += 1;
        progress();
      } catch (e) {
        skip('erro');
        console.log(id, e.message);
        // 429 é limite de chamadas de uma das duas APIs: insistir so descarta candidatas
        // (o cursor ja andou) e, na OpenDota, gasta o que sobrou do dia.
        if (e.status === 429 || Math.max(errorStreak.od, errorStreak.st) >= MAX_ERROR_STREAK) {
          console.log(e.status === 429 ? 'limite de chamadas atingido: parando.' : `${MAX_ERROR_STREAK} erros seguidos: parando.`);
          stop = true;
          break;
        }
        await sleep(5000);
      }
    }
    save();
  }

  save();
  if (!budgetLeft()) console.log(`orcamento diario da OpenDota no limite de reserva (${reserve}).`);
  console.log(`nesta execucao: +${addedPairs} pares, +${addedVolume} volume | gravado em ${path.relative(process.cwd(), DATA_DIR)}`);
  status(index);
})().catch((e) => {
  console.log('erro:', e.message);
  process.exit(1);
});
