/**
 * Proxima versao da release, a partir da ultima tag e do `package.json`. Chamado pelo passo
 * "Compute, commit and tag next version" do `.github/workflows/release.yml`.
 *
 *   node scripts/next-version.cjs <ultima-tag>     imprime a proxima versao (sem o "v")
 *   node scripts/next-version.cjs ""               sem tag: a versao do package.json
 *
 * A REGRA (decisao do dono, opcao (a) do §7 de docs/PROPOSTA-V2.md, 2026-11-19):
 *  - sem tag: a versao do `package.json`, como esta (primeira release do repo);
 *  - `major.minor` do `package.json` MAIOR que o da ultima tag: a versao do `package.json`.
 *    É o unico jeito de uma release subir major ou minor — editar `version` a mao, uma vez,
 *    no commit da versao (a 2.0.0 nasce assim);
 *  - qualquer outro caso: ultima tag + 1 no patch, como sempre foi. Patch maior no
 *    `package.json` é ignorado (o patch é do workflow), e `package.json` MENOR que a tag
 *    nunca faz a versao regredir.
 *
 * Por que existe: o passo antigo so sabia somar 1 ao patch. Criar a tag `v2.0.0` a mao nao
 * gera artefato (nenhum gatilho roda sobre tag), e o push seguinte viraria `v2.0.1`.
 *
 * Funcao pura exportada para o teste (`tests/scripts/next-version.test.cjs`); o resto é a CLI.
 */

const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;

function parseVersion(text, label) {
  const m = SEMVER.exec(String(text).trim());
  if (!m) throw new Error(`${label} nao é uma versao X.Y.Z: "${text}"`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/**
 * @param {string | null | undefined} latestTag  ultima tag (`v1.0.17`), ou vazio se nao ha
 * @param {string} packageVersion                `version` do package.json
 * @returns {string} a proxima versao, sem o "v"
 */
function nextVersion(latestTag, packageVersion) {
  const pkg = parseVersion(packageVersion, 'package.json');
  if (!latestTag || !String(latestTag).trim()) return `${pkg.major}.${pkg.minor}.${pkg.patch}`;

  const tag = parseVersion(latestTag, 'ultima tag');
  const pkgAhead = pkg.major > tag.major || (pkg.major === tag.major && pkg.minor > tag.minor);
  if (pkgAhead) return `${pkg.major}.${pkg.minor}.${pkg.patch}`;
  return `${tag.major}.${tag.minor}.${tag.patch + 1}`;
}

module.exports = { nextVersion, parseVersion };

if (require.main === module) {
  const path = require('path');
  const pkgVersion = require(path.join(process.cwd(), 'package.json')).version;
  try {
    process.stdout.write(`${nextVersion(process.argv[2], pkgVersion)}\n`);
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
}
