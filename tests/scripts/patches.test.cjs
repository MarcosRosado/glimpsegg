// `.cjs` com `globals: true`: describe/it/expect vem do ambiente (ver tests/CLAUDE.md).
const { patchOf, patchOfStart, TOP_LANE, LANES } = require('../../scripts/lib/patches.cjs');

const at = (iso) => Date.parse(iso) / 1000;

describe('patchOf — o patch de uma partida colhida (OpenDota + hora de inicio)', () => {
  it('a OpenDota da 61 a 7.42 e a 7.42a: a letra sai da hora de inicio', () => {
    expect(patchOf(61, at('2026-11-19T10:00:00Z'))).toBe('7.42');
    expect(patchOf(61, at('2026-11-25T02:00:00Z'))).toBe('7.42a');
  });

  it('a folga de 2 h depois da noticia da Steam fica como 7.42 (nunca 7.42 dentro da 7.42a)', () => {
    expect(patchOf(61, at('2026-11-24T23:50:00Z'))).toBe('7.42');
    expect(patchOf(61, at('2026-11-25T01:39:03Z'))).toBe('7.42');
    expect(patchOf(61, at('2026-11-25T01:39:04Z'))).toBe('7.42a');
  });

  it('sem hora de inicio (entrada gravada antes da trilha 7.42a) fica o patch maior', () => {
    expect(patchOf(61, undefined)).toBe('7.42');
    expect(patchOf(61, null)).toBe('7.42');
  });

  it('a letra so refina a 7.42; patch desconhecido nao se afirma', () => {
    expect(patchOf(60, at('2026-11-25T02:00:00Z'))).toBe('7.41');
    expect(patchOf(99, at('2026-11-25T02:00:00Z'))).toBeNull();
  });
});

describe('patchOfStart — a triagem, so pela hora de inicio', () => {
  it('separa as tres trilhas', () => {
    expect(patchOfStart(at('2026-11-17T00:00:00Z'))).toBe('7.41');
    expect(patchOfStart(at('2026-11-18T21:28:07Z'))).toBe('7.42');
    expect(patchOfStart(at('2026-11-25T01:39:04Z'))).toBe('7.42a');
    expect(patchOfStart(undefined)).toBeNull();
  });

  it('a trilha que comeca do topo é a mais nova', () => {
    expect(TOP_LANE).toBe('7.42a');
    expect(LANES[LANES.length - 1]).toBe(TOP_LANE);
  });
});
