/**
 * Acerta a consulta `imp.matchGenerator` da STRATZ e guarda a resposta — a quarta tarefa
 * da Fase 0 de docs/PLANO-OPENDOTA.md. Ela devolve, por minuto, os INSUMOS do IMP
 * (abates, cs, dano por tipo, cura, runas...) mais `winChance` e `impValues`: é o que
 * permite reconstruir uma nota propria (Fase 4) em vez de adivinhar a formula.
 *
 *   node scripts/probe-imp-generator.cjs <matchId> [profundidade=3]
 *
 * A selecao é montada por introspeccao do schema, nao de cabeca. Grava
 * `.gabarito/imp-generator-<matchId>.json` (fora do git) e imprime so a FORMA da
 * resposta. Vira fixture do repositorio so depois de anonimizada a mao.
 * O token nunca é impresso. Rodar da raiz.
 */
const fs = require('fs');
const path = require('path');
const { dataPath, requireToken, stratz, stratzField, stratzSelection, stratzTypeFields } = require('./lib/sources.cjs');

const shape = (v, d = 0) =>
  Array.isArray(v)
    ? `[${v.length}${v.length && d < 6 ? ' x ' + shape(v[0], d + 1) : ''}]`
    : v && typeof v === 'object'
      ? d < 6
        ? '{ ' + Object.entries(v).map(([k, x]) => `${k}: ${shape(x, d + 1)}`).join(', ') + ' }'
        : '{…}'
      : v === null
        ? 'null'
        : typeof v;

(async () => {
  const matchId = Number(process.argv[2]);
  const depth = Number(process.argv[3]) || 3;
  if (!Number.isSafeInteger(matchId) || matchId <= 0) {
    console.log('uso: node scripts/probe-imp-generator.cjs <matchId> [profundidade]');
    process.exit(1);
  }
  const token = requireToken();

  // Onde o gerador mora sai do schema, nao de cabeca: a primeira execucao assumiu
  // `Query.imp` e ele esta em outro lugar (hoje `stratz.page.imp`). Busca em largura, a
  // partir da raiz, por campos de objeto SEM argumento ate achar `matchGenerator`.
  const root = (await stratz(token, '{ __schema{ queryType{ name } } }')).__schema.queryType.name;
  let gen = null;
  let pathToGen = null;
  const queue = [[root, []]];
  const visited = new Set([root]);
  while (queue.length && !gen) {
    const [typeName, trail] = queue.shift();
    gen = await stratzField(token, typeName, 'matchGenerator');
    if (gen) { pathToGen = trail; break; }
    if (trail.length >= 3) continue;
    for (const f of await stratzTypeFields(token, typeName)) {
      const t = f.type;
      // So objeto direto (nao lista) e sem argumento: é o que da para atravessar sem id.
      const direct = t && t.kind === 'NON_NULL' ? t.ofType : t;
      if (!direct || direct.kind !== 'OBJECT' || (f.args && f.args.length) || visited.has(direct.name)) continue;
      if (!/Query$/.test(direct.name)) continue;
      visited.add(direct.name);
      queue.push([direct.name, trail.concat(f.name)]);
    }
  }
  if (!gen) throw new Error(`matchGenerator nao foi achado a partir de ${root} (tipos visitados: ${[...visited].join(', ')})`);
  console.log(`caminho: ${pathToGen.join('.')}.matchGenerator | argumentos (${gen.args.join(', ')}) -> ${gen.type.name}`);
  const wrap = (inner) => pathToGen.reduceRight((acc, f) => `${f}{ ${acc} }`, inner);
  const dig = (data) => pathToGen.reduce((acc, f) => acc?.[f], data)?.matchGenerator;

  // O argumento pode ser um escalar (`matchId`) ou um input (`request`): tenta o que o
  // schema lista, nessa ordem, e para no primeiro que responder.
  const skipped = [];
  const selection = await stratzSelection(token, gen.type.name, depth, skipped);
  console.log(`selecao: ${selection.length} caracteres | campos fora da selecao: ${skipped.length}`);
  for (const s of skipped) console.log('  fora:', s);
  const attempts = gen.args.includes('matchId')
    ? [`matchId:${matchId}`]
    : gen.args.map((a) => `${a}:{ matchId:${matchId} }`).concat(gen.args.map((a) => `${a}:${matchId}`));
  let data = null;
  for (const arg of attempts) {
    try {
      data = dig(await stratz(token, `{ ${wrap(`matchGenerator(${arg}){ ${selection} }`)} }`));
      if (data) {
        console.log(`consulta aceita com (${arg.replace(String(matchId), '<id>')})`);
        break;
      }
      // 200 com `matchGenerator: null`: o motivo, quando existe, vem em `errors`.
      console.log(`tentativa (${arg.replace(String(matchId), '<id>')}): resposta sem dado${stratz.lastErrors.length ? ' — ' + stratz.lastErrors.join('; ') : ''}`);
    } catch (e) {
      console.log(`tentativa (${arg.replace(String(matchId), '<id>')}): ${e.message}`);
    }
  }
  if (!data) {
    console.log('\nNenhuma tentativa respondeu. Selecao montada (para ajustar a mao):\n' + selection);
    process.exit(1);
  }
  const file = dataPath(`imp-generator-${matchId}.json`);
  fs.writeFileSync(file, JSON.stringify({ _query: wrap(`matchGenerator(matchId:<id>){ ${selection} }`), data }));
  console.log('gravado em', path.relative(process.cwd(), file));
  if (stratz.lastErrors.length) console.log('erros parciais:', stratz.lastErrors.join('; '));
  console.log('forma:', shape(data));
})().catch((e) => {
  console.log('erro:', e.message);
  process.exit(1);
});
