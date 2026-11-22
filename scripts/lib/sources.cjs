/**
 * Acesso compartilhado dos scripts de medicao da Fase 0 (docs/PLANO-OPENDOTA.md):
 * token da STRATZ, as duas APIs e o diretorio local do gabarito.
 *
 * O token é lido como em `check-patch-readiness.cjs` — de STRATZ_API_KEY ou do
 * `stratz_app_config.json` do app — e vai direto para o header. Ele NUNCA é impresso,
 * nem em erro: de uma resposta que falhou so sai o status HTTP, nunca o corpo. Manter
 * essa propriedade ao mexer aqui; o token nao é revogavel.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

/** Fora do git (`.gitignore`) e fora do app, por decisao (D5). */
const DATA_DIR = path.join(process.cwd(), '.gabarito');

function dataPath(...parts) {
  const full = path.join(DATA_DIR, ...parts);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  return full;
}

/**
 * Fonte propria do token, fora do app: `.gabarito/.stratz-token` (diretorio no .gitignore).
 * O app deixou de usar a STRATZ em 2026-11-19. Ele NAO apaga `stratzApiKey` do config (o
 * main regrava o objeto inteiro e o renderer nao toca mais nessa chave), entao a coleta
 * segue funcionando; este arquivo é a saida para quando o config for limpo ou em outra
 * maquina. Quem cria é o dono do token, a mao — nenhum script copia credencial.
 */
const TOKEN_FILE = path.join(DATA_DIR, '.stratz-token');

function readToken() {
  if (process.env.STRATZ_API_KEY) return process.env.STRATZ_API_KEY.trim();
  try {
    const own = fs.readFileSync(TOKEN_FILE, 'utf-8').trim();
    if (own) return own;
  } catch {
    // sem arquivo proprio: tenta o config do app
  }
  const home = os.homedir();
  const candidates = [
    path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'GlimpseGG'),
    path.join(home, 'Library', 'Application Support', 'GlimpseGG'),
    path.join(process.env.APPDATA || '', 'GlimpseGG'),
  ];
  for (const dir of candidates) {
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'stratz_app_config.json'), 'utf-8'));
      if (cfg.stratzApiKey) return String(cfg.stratzApiKey).trim();
    } catch {
      // proximo candidato
    }
  }
  return '';
}

/** Sai com mensagem se nao houver token. O valor nunca aparece na saida. */
function requireToken() {
  const token = readToken();
  if (!token) {
    console.log('Sem token da STRATZ: defina STRATZ_API_KEY ou grave o token em .gabarito/.stratz-token.');
    process.exit(1);
  }
  return token;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GraphQL da STRATZ. Lanca com o status ou com as mensagens de erro do GraphQL.
 *
 * De uma resposta que falhou sai o status e, se o corpo for JSON do GraphQL, SO o texto de
 * `errors[].message` (ex.: "Field X does not exist") — nunca o corpo cru nem cabecalho. Sem
 * isso um nome de campo errado vira "HTTP 400" mudo, e foi assim que a primeira tentativa de
 * `imp.matchGenerator` ficou sem diagnostico. `stratz.lastErrors` guarda as mensagens da
 * ultima resposta 200 que veio com `data` E `errors` (erro parcial).
 */
async function stratz(token, query, variables) {
  stratz.lastErrors = [];
  const res = await fetch('https://api.stratz.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'STRATZ_API',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const err = new Error(`STRATZ HTTP ${res.status}${gqlMessages(await res.json().catch(() => null))}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  if (json.errors?.length && !json.data) {
    throw new Error(`STRATZ GraphQL${gqlMessages(json)}`);
  }
  if (json.errors?.length) stratz.lastErrors = json.errors.map((e) => clip(e?.message));
  return json.data;
}

const clip = (m) => String(m ?? '').slice(0, 300);
/** `: msg1; msg2` com as mensagens de erro do GraphQL, ou vazio. So `message`, cortado. */
function gqlMessages(json) {
  const list = Array.isArray(json?.errors) ? json.errors.map((e) => clip(e?.message)).filter(Boolean) : [];
  return list.length ? `: ${list.slice(0, 5).join('; ')}` : '';
}

/**
 * GET na OpenDota, sem chave: 60 chamadas por minuto e 3.000 por dia. `remaining` vem
 * dos cabecalhos e é o que os coletores usam para parar antes de estourar o dia.
 */
const openDotaBudget = { minute: null, day: null };
async function openDota(endpoint) {
  const res = await fetch(`https://api.opendota.com/api/${endpoint}`, {
    signal: AbortSignal.timeout(60000),
  });
  // Cabecalho ausente NAO é saldo zero: `Number(null)` daria 0 e pararia o coletor.
  const minute = res.headers.get('x-rate-limit-remaining-minute');
  const day = res.headers.get('x-rate-limit-remaining-day');
  if (minute !== null && Number.isFinite(Number(minute))) openDotaBudget.minute = Number(minute);
  if (day !== null && Number.isFinite(Number(day))) openDotaBudget.day = Number(day);
  if (!res.ok) {
    const err = new Error(`OpenDota HTTP ${res.status}`);
    err.status = res.status;
    // O que a OpenDota disse no 429, para o log separar as causas: minuto zerado = outro
    // cliente no mesmo IP (o app); minuto e dia com saldo = limite do lado de la.
    err.minuteLeft = minute;
    err.dayLeft = day;
    err.retryAfter = res.headers.get('retry-after');
    throw err;
  }
  return res.json();
}

const RATE_LIMIT_BASE_MS = 60000;
const RATE_LIMIT_MAX_MS = 300000;
/**
 * Espera antes de repetir depois de um 429. `Retry-After` em segundos vence (com piso de 5 s e
 * teto de 5 min); sem ele, 60 s, 120 s, 240 s... ate o teto. A janela da OpenDota é de um
 * minuto, entao a primeira espera ja cobre o caso comum.
 */
function rateLimitWaitMs(retryAfter, attempt) {
  const s = Number(retryAfter);
  if (retryAfter !== null && retryAfter !== undefined && retryAfter !== '' && Number.isFinite(s) && s >= 0) {
    return Math.min(RATE_LIMIT_MAX_MS, Math.max(5000, s * 1000));
  }
  return Math.min(RATE_LIMIT_MAX_MS, RATE_LIMIT_BASE_MS * 2 ** attempt);
}

/**
 * `openDota` que espera e repete o MESMO endpoint num 429, ate `tries` tentativas. Existe
 * porque o coletor parava no primeiro 429 com o dia quase inteiro de saldo (2026-11-20: 1.276
 * chamadas sobrando; 2026-11-21: 2.917, depois de 60 chamadas) e perdia a cota do dia. Dia
 * zerado no cabecalho nao se repete: ali a espera nao resolve ate a virada. Outro status
 * qualquer sobe na hora, como antes.
 */
async function openDotaWithRetry(endpoint, { tries = 4, log = console.log } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await openDota(endpoint);
    } catch (e) {
      const dayZero = e.dayLeft !== null && e.dayLeft !== undefined && Number(e.dayLeft) <= 0;
      if (e.status !== 429 || dayZero || attempt + 1 >= tries) throw e;
      const wait = rateLimitWaitMs(e.retryAfter, attempt);
      log(`OpenDota 429 em ${endpoint.split('?')[0]} | saldo minuto ${e.minuteLeft ?? '?'} | dia ${e.dayLeft ?? '?'} | retry-after ${e.retryAfter ?? '-'} | esperando ${Math.round(wait / 1000)} s (tentativa ${attempt + 2} de ${tries})`);
      await sleep(wait);
    }
  }
}

// Seis niveis: `[[X!]!]!` (lista de lista) precisa de cinco, e tipo que nao desembrulha
// ate o fim seria descartado da selecao sem aviso.
const TYPE_REF = 'kind name ofType{ kind name ofType{ kind name ofType{ kind name ofType{ kind name ofType{ kind name } } } } }';
const unwrap = (t) => (t && (t.kind === 'NON_NULL' || t.kind === 'LIST') ? unwrap(t.ofType) : t);

/** Campos de um tipo do schema da STRATZ, por introspeccao. Cacheado por execucao. */
const typeCache = new Map();
async function stratzTypeFields(token, typeName) {
  if (!typeCache.has(typeName)) {
    const data = await stratz(
      token,
      `{ __type(name:"${typeName}"){ fields{ name args{ name } type{ ${TYPE_REF} } } } }`,
    );
    typeCache.set(typeName, data?.__type?.fields || []);
  }
  return typeCache.get(typeName);
}

/**
 * Monta a selecao GraphQL de um tipo a partir do PROPRIO schema: todo campo escalar ou
 * enum, e os objetos ate `depth` niveis. Campo que exige argumento fica de fora. Existe
 * para nao escrever nome de campo de cabeca — a consulta de `imp.matchGenerator`
 * devolveu HTTP 400 na primeira tentativa exatamente por isso.
 *
 * `skipped`, se passado, recebe `Tipo.campo (motivo)` de tudo que ficou de fora: campo
 * descartado em silencio é serie que falta na resposta sem ninguem saber.
 */
async function stratzSelection(token, typeName, depth, skipped) {
  const parts = [];
  const skip = (f, why) => skipped && skipped.push(`${typeName}.${f.name} (${why})`);
  for (const f of await stratzTypeFields(token, typeName)) {
    if (f.args && f.args.length) { skip(f, `exige argumento: ${f.args.map((a) => a.name).join(', ')}`); continue; }
    const t = unwrap(f.type);
    if (!t || !t.kind) { skip(f, 'tipo nao desembrulhou'); continue; }
    if (t.kind === 'SCALAR' || t.kind === 'ENUM') parts.push(f.name);
    else if (t.kind === 'OBJECT' && depth > 0) {
      const sub = await stratzSelection(token, t.name, depth - 1, skipped);
      if (sub) parts.push(`${f.name}{ ${sub} }`);
      else skip(f, `${t.name} sem campo selecionavel`);
    } else skip(f, t.kind === 'OBJECT' ? `objeto ${t.name} alem da profundidade` : `tipo ${t.kind}`);
  }
  return parts.join(' ');
}

/** Tipo (ja desembrulhado) e argumentos de `Tipo.campo`. `null` se o campo nao existe. */
async function stratzField(token, typeName, fieldName) {
  const f = (await stratzTypeFields(token, typeName)).find((x) => x.name === fieldName);
  return f ? { type: unwrap(f.type), args: (f.args || []).map((a) => a.name) } : null;
}

/**
 * Arquivos de amostra sao DATADOS e nunca sobrescritos: `<prefixo>-AAAA-MM-DD.json`, com
 * hora no nome se o do dia ja existir. A coleta de 2026-11-19 é a unica copia que
 * reproduz o §1 do plano, e a STRATZ pode nao responder de novo.
 */
function newSnapshotPath(prefix) {
  const now = new Date().toISOString();
  const day = dataPath(`${prefix}-${now.slice(0, 10)}.json`);
  if (!fs.existsSync(day)) return day;
  return dataPath(`${prefix}-${now.slice(0, 10)}-${now.slice(11, 19).replace(/:/g, '')}.json`);
}

/** O arquivo pedido na linha de comando ou, sem ele, a amostra mais recente pelo nome. */
function latestSnapshotPath(prefix, explicit) {
  if (explicit) return path.resolve(explicit);
  let names = [];
  try {
    names = fs.readdirSync(DATA_DIR).filter((n) => n.startsWith(`${prefix}-`) && n.endsWith('.json'));
  } catch {
    // diretorio ainda nao existe
  }
  return names.length ? path.join(DATA_DIR, names.sort()[names.length - 1]) : null;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return fallback;
  }
}

module.exports = { DATA_DIR, dataPath, readToken, requireToken, sleep, stratz, openDota, openDotaWithRetry, rateLimitWaitMs, openDotaBudget, readJson,
  newSnapshotPath, latestSnapshotPath,
  stratzTypeFields, stratzSelection, stratzField };
