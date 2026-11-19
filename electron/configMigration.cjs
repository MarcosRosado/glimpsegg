/**
 * Migracao do arquivo de config: `stratz_app_config.json` -> `glimpsegg_config.json`
 * (renomes do §6 de docs/PROPOSTA-V2.md, 2026-11-19).
 *
 * A REGRA: no primeiro inicio da versao nova, se o arquivo novo NAO existe e o antigo existe,
 * COPIA todas as chaves do antigo menos `stratzApiKey` para o novo e deixa o antigo INTOCADO.
 *
 *  - Por que copiar e nao renomear: o app nao le, nao grava e nao apaga a chave `stratzApiKey`
 *    (doutrina desde que a STRATZ saiu), e os scripts de medicao (`scripts/lib/sources.cjs`,
 *    `scripts/check-patch-readiness.cjs`) ainda a procuram no arquivo ANTIGO como ultimo
 *    recurso. Renomear o arquivo moveria o token para um lugar que ninguem procura, e
 *    reescrever o antigo seria o app tocando na chave.
 *  - Por que tirar `stratzApiKey` do novo: o arquivo novo nasce sem segredo nenhum. Copiar o
 *    token para um segundo arquivo em texto claro so dobraria onde ele pode vazar.
 *  - Arquivo novo ja existe: nada acontece, nem que o antigo tenha mudado depois — a
 *    migracao roda uma vez. Antigo ilegivel (JSON quebrado): nada é criado, e o app nasce com
 *    o config padrao, como faria sem arquivo nenhum; o antigo continua la.
 *
 * Escrita atomica (tmp + rename), como a do hero grid: um app fechado no meio da migracao nao
 * pode deixar um `glimpsegg_config.json` pela metade, que na proxima abertura contaria como
 * "ja migrado".
 *
 * Testado em `tests/electron/configMigration.test.cjs`.
 */
const path = require('path');
const nodeFs = require('fs');

const CONFIG_FILE = 'glimpsegg_config.json';
const LEGACY_CONFIG_FILE = 'stratz_app_config.json';
/** A unica chave que NAO atravessa: o token da STRATZ fica so no arquivo antigo. */
const LEGACY_ONLY_KEYS = ['stratzApiKey'];

/** O config novo a partir do antigo, sem as chaves que ficam para tras. Puro. */
function migratedConfig(legacy) {
  const out = {};
  for (const [k, v] of Object.entries(legacy || {})) {
    if (!LEGACY_ONLY_KEYS.includes(k)) out[k] = v;
  }
  return out;
}

/**
 * Executa a migracao em `dir` (o `userData`). Devolve o que fez:
 *  'present'  — o arquivo novo ja existia;
 *  'none'     — nao ha arquivo antigo;
 *  'invalid'  — o antigo nao é um objeto JSON legivel; nada foi criado;
 *  'migrated' — o novo foi criado a partir do antigo.
 */
function migrateLegacyConfig(dir, fs = nodeFs) {
  const target = path.join(dir, CONFIG_FILE);
  const legacy = path.join(dir, LEGACY_CONFIG_FILE);
  if (fs.existsSync(target)) return 'present';
  if (!fs.existsSync(legacy)) return 'none';

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(legacy, 'utf-8'));
  } catch {
    return 'invalid';
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'invalid';

  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(migratedConfig(parsed), null, 2), 'utf-8');
  fs.renameSync(tmp, target);
  return 'migrated';
}

module.exports = { CONFIG_FILE, LEGACY_CONFIG_FILE, LEGACY_ONLY_KEYS, migratedConfig, migrateLegacyConfig };
