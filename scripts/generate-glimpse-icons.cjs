/**
 * Gera todos os binários de ícone do GlimpseGG a partir dos masters SVG.
 *
 *   node scripts/generate-glimpse-icons.cjs            gera tudo
 *   node scripts/generate-glimpse-icons.cjs --check     valida o manifesto (não rasteriza)
 *
 * Fonte-mestre: build/icon.svg
 * Master opcional para tamanhos pequenos: build/icon-small.svg (usado em sizes <= 48)
 *
 * O CI não gera ícones: o que está commitado é o que a release publica.
 * O modo --check existe para transformar "esqueci de regenerar" em erro vermelho.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync, execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const p = (...s) => path.join(rootDir, ...s);

const MASTER = p('build', 'icon.svg');
const MASTER_SMALL = p('build', 'icon-small.svg');
const iconsDir = p('build', 'icons');
const mainPng = p('build', 'icon.png');
const mainIco = p('build', 'icon.ico');
const publicDir = p('public');
const faviconSvg = p('public', 'favicon.svg');
const favicon32 = p('public', 'favicon-32.png');
const manifestPath = p('build', 'icons.manifest.json');

const SIZES = [16, 32, 48, 64, 128, 256, 512, 1024];
const SMALL_THRESHOLD = 48;
const ICO_SIZES = [16, 32, 48, 64, 128, 256];

const checkOnly = process.argv.includes('--check');

const rel = (f) => path.relative(rootDir, f);
const die = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};
const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// ---------------------------------------------------------------- binário IM

let magickCmd = null;
function magick(args) {
  if (!magickCmd) {
    for (const candidate of ['magick', 'convert']) {
      try {
        execFileSync(candidate, ['-version'], { stdio: 'pipe' });
        magickCmd = candidate;
        break;
      } catch {
        /* tenta o próximo */
      }
    }
    if (!magickCmd) die('ImageMagick não encontrado no PATH (nem `magick`, nem `convert`).');
  }
  return execFileSync(magickCmd, args, { stdio: 'pipe' });
}

function identify(file, format) {
  return execFileSync(magickCmd === 'magick' ? 'magick' : 'identify',
    magickCmd === 'magick' ? ['identify', '-format', format, file] : ['-format', format, file],
    { stdio: 'pipe' }).toString().trim();
}

// ------------------------------------------------------------------ manifesto

function masterList() {
  const list = [MASTER];
  if (fs.existsSync(MASTER_SMALL)) list.push(MASTER_SMALL);
  return list;
}

function outputList() {
  const outs = SIZES.map((s) => path.join(iconsDir, `${s}x${s}.png`));
  outs.push(mainPng, mainIco, faviconSvg, favicon32);
  return outs;
}

function buildManifest() {
  const masters = {};
  for (const m of masterList()) masters[rel(m)] = sha256(m);
  const outputs = {};
  for (const o of outputList()) outputs[rel(o)] = sha256(o);
  return { masters, outputs, sizes: SIZES };
}

// ---------------------------------------------------------------------- check

if (checkOnly) {
  if (!fs.existsSync(manifestPath)) {
    die(`${rel(manifestPath)} não existe. Rode \`npm run icons:generate\` e commite o resultado.`);
  }
  const saved = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const problems = [];

  const currentMasters = masterList().map(rel).sort();
  const savedMasters = Object.keys(saved.masters || {}).sort();
  if (currentMasters.join('|') !== savedMasters.join('|')) {
    problems.push(`conjunto de masters mudou: manifesto tem [${savedMasters}], disco tem [${currentMasters}]`);
  }

  for (const [file, hash] of Object.entries(saved.masters || {})) {
    const abs = p(file);
    if (!fs.existsSync(abs)) problems.push(`master ausente: ${file}`);
    else if (sha256(abs) !== hash) problems.push(`master alterado sem regenerar os ícones: ${file}`);
  }
  for (const [file, hash] of Object.entries(saved.outputs || {})) {
    const abs = p(file);
    if (!fs.existsSync(abs)) problems.push(`saída ausente: ${file}`);
    else if (sha256(abs) !== hash) problems.push(`saída divergente do manifesto: ${file}`);
  }

  if (problems.length) {
    console.error('✗ Ícones fora de sincronia:\n');
    for (const s of problems) console.error(`   • ${s}`);
    console.error('\n  Rode `npm run icons:generate` e commite os binários junto com o SVG.');
    process.exit(1);
  }
  console.log('✓ Ícones em sincronia com os masters.');
  process.exit(0);
}

// ------------------------------------------------------------------ preflight

if (!fs.existsSync(MASTER)) die(`master ausente: ${rel(MASTER)}`);

magick(['-version']); // resolve magickCmd, ou morre

// librsvg é o que rasteriza gradiente e filtro corretamente. Sem ele, o IM cai no
// renderizador interno MSVG, que os ignora e produz um ícone destruído SEM erro.
const formats = magick(['-list', 'format']).toString();
if (!/RSVG/i.test(formats)) {
  die('ImageMagick sem delegate RSVG (librsvg). O renderizador MSVG interno ignora gradientes e filtros — o ícone sairia destruído sem erro. Instale librsvg e refaça.');
}

// `fc-match "JetBrains Mono"` resolve para Noto Sans nesta máquina: <text> em SVG
// rasteriza com a fonte que o fontconfig decidir, e sai diferente em cada máquina.
for (const m of masterList()) {
  // Comentários fora: um <!-- ... --> pode mencionar o literal legitimamente.
  const markup = fs.readFileSync(m, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  if (/<text[\s>]/.test(markup)) {
    die(`${rel(m)} contém <text>. A fonte resolvida pelo fontconfig varia por máquina — converta o texto em <path>.`);
  }
}

if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

console.log(`Gerando ícones do GlimpseGG (${magickCmd}, RSVG ok)...`);
if (fs.existsSync(MASTER_SMALL)) console.log(`  master small ativo para sizes <= ${SMALL_THRESHOLD}`);

// ---------------------------------------------------------------- rasterização

for (const size of SIZES) {
  const src = size <= SMALL_THRESHOLD && fs.existsSync(MASTER_SMALL) ? MASTER_SMALL : MASTER;
  const out = path.join(iconsDir, `${size}x${size}.png`);
  try {
    magick([
      '-background', 'none',
      '-density', '300',
      src,
      '-resize', `${size}x${size}`,
      '-alpha', 'on',
      '-strip',
      '-depth', '8',
      '-define', 'png:compression-level=9',
      out,
    ]);
  } catch (err) {
    die(`falha rasterizando ${size}x${size} de ${rel(src)}: ${err.message}`);
  }

  // Pega o caso silencioso do -resize ter produzido outra dimensão ou 16-bit.
  const got = identify(out, '%w %h %[bit-depth]');
  if (got !== `${size} ${size} 8`) {
    die(`${rel(out)} saiu como "${got}", esperado "${size} ${size} 8"`);
  }
  console.log(`  ✓ ${size}x${size}.png  (${fs.statSync(out).size.toLocaleString()} B)`);
}

fs.copyFileSync(path.join(iconsDir, '512x512.png'), mainPng);
console.log(`  ✓ ${rel(mainPng)}`);

// .ico com camadas BMP cru (default do IM). Maior que a variante PNG do icotool,
// mas o NSIS engasga com PNG-in-ICO — instalador sem ícone é pior que 370 KB.
try {
  magick([...ICO_SIZES.map((s) => path.join(iconsDir, `${s}x${s}.png`)), mainIco]);
} catch (err) {
  die(`falha montando ${rel(mainIco)}: ${err.message}`);
}
// `-format '%n'` repete o valor por camada ("666666"), então conta-se as linhas.
const icoLayers = identify(mainIco, '%w\n').split('\n').filter(Boolean).length;
if (icoLayers !== ICO_SIZES.length) {
  die(`${rel(mainIco)} tem ${icoLayers} camadas, esperado ${ICO_SIZES.length}`);
}
console.log(`  ✓ ${rel(mainIco)} (${icoLayers} camadas)`);

// public/ deixa de ser uma segunda arte: passa a ser derivado do mesmo master.
fs.copyFileSync(MASTER, faviconSvg);
fs.copyFileSync(path.join(iconsDir, '32x32.png'), favicon32);
console.log(`  ✓ ${rel(faviconSvg)}\n  ✓ ${rel(favicon32)}`);

fs.writeFileSync(manifestPath, JSON.stringify(buildManifest(), null, 2) + '\n');
console.log(`  ✓ ${rel(manifestPath)}`);

console.log('\n🎉 Ícones gerados. Commite os binários junto com o SVG — o CI não os regenera.');
