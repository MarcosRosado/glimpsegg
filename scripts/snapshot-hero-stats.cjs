/**
 * Fotografia de `heroStats.stats` da STRATZ: a media do heroi por posicao, faixa de
 * ranque e minuto, sem precisar de partida. Segunda tarefa da Fase 0 de
 * docs/PLANO-OPENDOTA.md.
 *
 *   node scripts/snapshot-hero-stats.cjs                 colhe (retoma de onde parou)
 *   node scripts/snapshot-hero-stats.cjs --status        so o manifesto, sem rede
 *   node scripts/snapshot-hero-stats.cjs --retry-empty   refaz as requisicoes com alguma posicao sem linha
 *   node scripts/snapshot-hero-stats.cjs 2026-11-19      retoma/consulta a fotografia DAQUELE dia
 *
 * A pasta é a do dia (UTC) em que a coleta comecou. Para terminar no dia seguinte uma
 * coleta interrompida, passe a data dela — sem isso comeca uma fotografia nova.
 *
 * REGUA INTERNA, por decisao (D5): serve para validar as curvas proprias da Fase 2 e
 * NUNCA entra no repositorio nem no app. Sai em `.gabarito/hero-stats/<AAAA-MM-DD>/`,
 * um arquivo por heroi e faixa, mais `manifest.json` com `matchCount` por celula — a
 * celula sem linha fica marcada vazia em vez de sumir.
 *
 * Uma requisicao por heroi x faixa (as cinco posicoes juntas), uma por segundo: cerca
 * de 510 chamadas, uns dez minutos, bem abaixo do limite horario do token.
 * O token nunca é impresso. Rodar da raiz.
 */
const fs = require('fs');
const path = require('path');
const { DATA_DIR, dataPath, requireToken, sleep, stratz, stratzField, stratzSelection, readJson } = require('./lib/sources.cjs');

const POSITIONS = ['POSITION_1', 'POSITION_2', 'POSITION_3', 'POSITION_4', 'POSITION_5'];
const BRACKETS = ['HERALD_GUARDIAN', 'CRUSADER_ARCHON', 'LEGEND_ANCIENT', 'DIVINE_IMMORTAL'];
const MIN_TIME = 0;
const MAX_TIME = 60;

const today = new Date().toISOString().slice(0, 10);
const dirArg = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
const DAY = dirArg || today;
// Caminho sem `dataPath`: `--status` so le, e nao deve criar pasta vazia.
const manifestPath = path.join(DATA_DIR, 'hero-stats', DAY, 'manifest.json');
const manifestFile = () => dataPath('hero-stats', DAY, 'manifest.json');

function status(manifest) {
  const cells = Object.values(manifest.cells || {});
  const filled = cells.filter((c) => c.rows > 0);
  console.log(`fotografia ${DAY}: ${Object.keys(manifest.done || {}).length} requisicoes concluidas | celulas (heroi x posicao x faixa): ${cells.length} | com dado: ${filled.length} | vazias: ${cells.length - filled.length}`);
  const am = (manifest.cells || {})['1:POSITION_1:DIVINE_IMMORTAL'];
  if (am) console.log(`  Anti-Mage pos 1 DIVINE_IMMORTAL aos 10 min: ${am.matchCountAt10} partidas (§1: 45.277)`);
  for (const b of BRACKETS) {
    const inB = cells.filter((c) => c.bracket === b);
    const at10 = inB.map((c) => c.matchCountAt10).filter((n) => typeof n === 'number').sort((x, y) => x - y);
    console.log(`  ${b.padEnd(16)} celulas ${inB.length} | matchCount aos 10 min p10/p50/p90: ${at10.length ? [0.1, 0.5, 0.9].map((p) => at10[Math.min(at10.length - 1, Math.floor(p * at10.length))]).join(' / ') : 'n/d'}`);
  }
}

(async () => {
  const manifest = readJson(manifestPath, { date: DAY, minTime: MIN_TIME, maxTime: MAX_TIME, done: {}, cells: {} });
  if (process.argv.includes('--status')) return status(manifest);
  if (process.argv.includes('--retry-empty')) {
    // Refaz toda requisicao em que ALGUMA posicao veio sem linha. Medido em 2026-11-19: a
    // STRATZ devolveu um heroi comum inteiro vazio em duas faixas e, em outra requisicao,
    // omitiu uma posicao so; as tres voltaram completas ao repetir. O arquivo é regravado
    // com a resposta nova; vazio que se repete é que vale como "sem amostra".
    const byReq = {};
    for (const c of Object.values(manifest.cells)) (byReq[`${c.heroId}:${c.bracket}`] ||= []).push(c);
    const redo = Object.entries(byReq).filter(([, cs]) => cs.some((c) => !c.rows)).map(([k]) => k);
    for (const k of redo) delete manifest.done[k];
    console.log(`refazendo ${redo.length} requisicoes vazias: ${redo.join(' ') || '(nenhuma)'}`);
  }

  const token = requireToken();
  const heroIds = ((await stratz(token, '{ constants{ heroes{ id } } }'))?.constants?.heroes || [])
    .map((h) => h.id)
    .filter((id) => typeof id === 'number' && id > 0)
    .sort((a, b) => a - b);
  if (!heroIds.length) throw new Error('a STRATZ nao devolveu a lista de herois');

  // Todos os campos escalares do tipo de retorno, lidos do schema (sao ~70).
  const root = (await stratz(token, '{ __schema{ queryType{ name } } }')).__schema.queryType.name;
  const heroStats = await stratzField(token, root, 'heroStats');
  const statsField = heroStats && (await stratzField(token, heroStats.type.name, 'stats'));
  if (!statsField) throw new Error('heroStats.stats nao existe mais no schema');
  const selection = await stratzSelection(token, statsField.type.name, 0);
  console.log(`herois: ${heroIds.length} | campos por linha: ${selection.split(' ').length} | tipo ${statsField.type.name}`);

  // Os argumentos saem do schema, nao de cabeca: argumento inexistente é erro de validacao
  // em TODAS as ~510 requisicoes. Os obrigatorios abortam; os `groupBy*` entram se existirem.
  console.log(`argumentos de stats: ${statsField.args.join(', ')}`);
  const missingArgs = ['heroIds', 'positionIds', 'bracketBasicIds', 'groupByTime', 'minTime', 'maxTime'].filter((a) => !statsField.args.includes(a));
  if (missingArgs.length) throw new Error(`heroStats.stats nao aceita mais: ${missingArgs.join(', ')} — ajustar a consulta a mao`);
  const groupBy = ['groupByTime', 'groupByPosition', 'groupByBracket'].filter((a) => statsField.args.includes(a));
  // O manifesto le estes tres campos da linha. Sem eles toda celula sairia "vazia", e
  // vazio aqui é afirmacao ("a STRATZ nao tem amostra"), nao pode nascer de nome errado.
  const fieldNames = selection.split(' ');
  const missingFields = ['position', 'time', 'matchCount'].filter((f) => !fieldNames.includes(f));
  if (missingFields.length) throw new Error(`${statsField.type.name} nao tem: ${missingFields.join(', ')} — campos: ${fieldNames.join(' ')}`);

  const MAX_STREAK = 5;
  let requests = 0;
  let streak = 0;
  let checkedShape = false;
  outer: for (const heroId of heroIds) {
    for (const bracket of BRACKETS) {
      const key = `${heroId}:${bracket}`;
      if (manifest.done[key]) continue;
      const query = `{ heroStats{ stats(heroIds:[${heroId}], positionIds:[${POSITIONS.join(',')}], bracketBasicIds:[${bracket}], ${groupBy.map((g) => g + ':true').join(', ')}, minTime:${MIN_TIME}, maxTime:${MAX_TIME}){ ${selection} } } }`;
      try {
        const rows = (await stratz(token, query))?.heroStats?.stats || [];
        if (!checkedShape && rows.length) {
          // Valor, nao so nome: `position` tem de vir como POSITION_n e `time` em minutos.
          const r = rows[0];
          if (!POSITIONS.includes(r.position) || typeof r.time !== 'number' || typeof r.matchCount !== 'number') {
            throw Object.assign(new Error(`linha em formato inesperado: position=${JSON.stringify(r.position)} time=${JSON.stringify(r.time)} matchCount=${JSON.stringify(r.matchCount)}`), { fatal: true });
          }
          checkedShape = true;
        }
        fs.writeFileSync(dataPath('hero-stats', DAY, `hero-${heroId}-${bracket}.json`), JSON.stringify(rows));
        for (const position of POSITIONS) {
          const own = rows.filter((r) => r.position === position);
          const at10 = own.find((r) => r.time === 10);
          manifest.cells[`${heroId}:${position}:${bracket}`] = {
            heroId, position, bracket, rows: own.length,
            matchCountAt10: at10 ? at10.matchCount : null,
          };
        }
        manifest.done[key] = true;
        streak = 0;
        // Posicao sem linha é suspeita, nao conclusiva: ver `--retry-empty`.
        const emptyPos = POSITIONS.filter((p) => !rows.some((r) => r.position === p));
        if (emptyPos.length) console.log(`  heroi ${heroId} ${bracket}: sem linha em ${emptyPos.join(', ')} — conferir com --retry-empty`);
        if (heroId === 1 && bracket === 'DIVINE_IMMORTAL') {
          const c = manifest.cells['1:POSITION_1:DIVINE_IMMORTAL'];
          console.log(`  conferencia do §1 — Anti-Mage pos 1 Divine/Immortal aos 10 min: ${c.matchCountAt10} partidas (medido em 2026-11-19: 45.277) | linhas ${c.rows} | linhas na resposta ${rows.length}`);
        }
      } catch (e) {
        console.log(`heroi ${heroId} ${bracket}: ${e.message}`);
        streak += 1;
        if (e.fatal || streak >= MAX_STREAK) {
          console.log(e.fatal ? 'abortando: formato inesperado.' : `abortando: ${MAX_STREAK} falhas seguidas.`);
          break outer;
        }
        await sleep(5000);
      }
      requests += 1;
      if (requests % 20 === 0) {
        fs.writeFileSync(manifestFile(), JSON.stringify(manifest));
        console.log(`  ${Object.keys(manifest.done).length}/${heroIds.length * BRACKETS.length}`);
      }
      await sleep(1000);
    }
  }
  fs.writeFileSync(manifestFile(), JSON.stringify(manifest));
  console.log('gravado em', path.relative(process.cwd(), path.dirname(manifestFile())));
  status(manifest);
  const missing = heroIds.length * BRACKETS.length - Object.keys(manifest.done).length;
  if (missing > 0) console.log(`${missing} requisicoes falharam: rode de novo para completar (retoma do manifesto).`);
})().catch((e) => {
  console.log('erro:', e.message);
  process.exit(1);
});
