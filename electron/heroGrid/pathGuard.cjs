const path = require('path');

const { steamRootCandidates, isAccountDirName } = require('./steamPaths.cjs');

/**
 * Guarda S-1: valida o caminho que o RENDERER manda antes de o main tocar no disco.
 *
 * Por que isto existe e por que mora no main: os handlers `grid:*` recebem um `path` vindo
 * do renderer. Sem validacao, um renderer comprometido (ou um bug de estado que passe a
 * string errada) faria o processo privilegiado ler ou SOBRESCREVER qualquer arquivo do
 * usuario, com backup e escrita atomica e tudo. A ponte em `src/services/heroGrid/` NAO é
 * a fronteira de confianca — ela roda do lado de quem pode estar errado.
 *
 * Por que é um modulo separado e testado, em vez de um `if` dentro do `main.cjs`: é regra
 * de seguranca com casos de borda (`..`, symlink, prefixo que parece raiz mas nao é), e o
 * `CLAUDE.md` é explicito em que logica que decide precisa estar onde o vitest alcanca.
 */

const GRID_FILE_NAME = 'hero_grid_config.json';

/** `userdata/<id3>/570/remote/cfg/hero_grid_config.json` — o sufixo exigido pelo contrato. */
const REQUIRED_SEGMENTS = ['userdata', null, '570', 'remote', 'cfg'];

/**
 * Normaliza sem resolver symlink. `path.resolve` ja colapsa `..` e `.`, que é o que impede
 * `<raiz>/userdata/1/570/remote/cfg/../../../../../../etc/passwd` de passar por parecer
 * estar sob a raiz.
 */
function normalize(p) {
  if (typeof p !== 'string' || p.trim() === '') return null;
  return path.resolve(p);
}

/**
 * O caminho tem a forma `<algo>/userdata/<id3>/570/remote/cfg/hero_grid_config.json`?
 * Devolve `{ steamRoot, steamId3 }` ou `null`. Puro.
 */
function decomposeGridPath(filePath) {
  const abs = normalize(filePath);
  if (!abs) return null;
  if (path.basename(abs) !== GRID_FILE_NAME) return null;

  const parts = abs.split(path.sep);
  // -1 é o nome do arquivo; os 5 anteriores sao os segmentos exigidos.
  const tail = parts.slice(-(REQUIRED_SEGMENTS.length + 1), -1);
  if (tail.length !== REQUIRED_SEGMENTS.length) return null;

  for (let i = 0; i < REQUIRED_SEGMENTS.length; i += 1) {
    const expected = REQUIRED_SEGMENTS[i];
    // `null` é a posicao do id3: qualquer inteiro positivo serve, e I-26 vale aqui tambem.
    if (expected === null) {
      if (!isAccountDirName(tail[i])) return null;
    } else if (tail[i] !== expected) {
      return null;
    }
  }

  const rootParts = parts.slice(0, -(REQUIRED_SEGMENTS.length + 1));
  const steamRoot = rootParts.join(path.sep) || path.sep;
  const steamId3 = tail[REQUIRED_SEGMENTS.indexOf(null)];
  return { steamRoot, steamId3 };
}

/** `child` esta sob `parent`? Compara por segmento, nao por prefixo de string. */
function isInside(parent, child) {
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * A guarda em si.
 *
 * Aceita o caminho em DOIS casos, e so nesses:
 *  (a) ele decompoe na forma do contrato e a raiz é uma das raizes Steam reconhecidas —
 *      comparada por `realpath` quando possivel, porque na maquina real tres raizes
 *      apontam para o mesmo diretorio e recusar por diferenca de symlink seria recusar a
 *      unica conta que existe;
 *  (b) ele é EXATAMENTE o caminho manual que o jogador configurou (FR-006), que é o que
 *      cobre Steam em disco secundario, Flatpak e Snap fora das raizes conhecidas.
 *
 * O caso (b) é deliberadamente igualdade exata, nao "sob o diretorio do caminho manual":
 * o jogador aponta um arquivo, nao autoriza uma arvore.
 */
function assertAllowedGridPath(filePath, options = {}) {
  const {
    platform = process.platform,
    homeDir = require('os').homedir(),
    manualPath = null,
    fsImpl = require('fs'),
  } = options;

  const abs = normalize(filePath);
  if (!abs) return { allowed: false, reason: 'EMPTY_PATH' };
  if (path.basename(abs) !== GRID_FILE_NAME) return { allowed: false, reason: 'NOT_GRID_FILE' };

  const manualAbs = normalize(manualPath);
  if (manualAbs && abs === manualAbs) {
    return { allowed: true, via: 'MANUAL_PATH' };
  }

  const decomposed = decomposeGridPath(abs);
  if (!decomposed) return { allowed: false, reason: 'BAD_SHAPE' };

  const real = (p) => {
    try {
      return fsImpl.realpathSync(p);
    } catch {
      return p;
    }
  };

  const candidateRoot = real(decomposed.steamRoot);
  for (const root of steamRootCandidates(platform, homeDir)) {
    if (candidateRoot === real(root) || isInside(real(root), candidateRoot)) {
      return { allowed: true, via: 'STEAM_ROOT', steamId3: decomposed.steamId3 };
    }
  }

  return { allowed: false, reason: 'UNKNOWN_STEAM_ROOT' };
}

module.exports = {
  GRID_FILE_NAME,
  decomposeGridPath,
  assertAllowedGridPath,
};
