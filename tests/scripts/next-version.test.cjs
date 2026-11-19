// `.cjs` com `globals: true`: describe/it/expect vem do ambiente (ver tests/CLAUDE.md).
const { nextVersion } = require('../../scripts/next-version.cjs');

describe('nextVersion — o passo de versao do release.yml', () => {
  it('sem tag: a versao do package.json, como esta', () => {
    expect(nextVersion('', '1.0.0')).toBe('1.0.0');
    expect(nextVersion(undefined, '2.0.0')).toBe('2.0.0');
    expect(nextVersion(null, '0.3.7')).toBe('0.3.7');
  });

  it('package.json igual a tag: soma 1 ao patch (o caso de todo push)', () => {
    expect(nextVersion('v1.0.17', '1.0.17')).toBe('1.0.18');
  });

  it('package.json com patch maior e mesmo major.minor: ignora e soma 1, como sempre', () => {
    expect(nextVersion('v1.0.17', '1.0.40')).toBe('1.0.18');
  });

  it('package.json com minor ou major maior: usa a versao do package.json', () => {
    expect(nextVersion('v1.0.17', '2.0.0')).toBe('2.0.0');
    expect(nextVersion('v1.0.17', '1.1.0')).toBe('1.1.0');
    // major maior com minor menor continua sendo maior
    expect(nextVersion('v1.9.3', '2.0.0')).toBe('2.0.0');
  });

  it('package.json menor que a tag: soma 1 a tag, nunca regride', () => {
    expect(nextVersion('v2.0.0', '1.0.17')).toBe('2.0.1');
    expect(nextVersion('v2.1.4', '2.0.9')).toBe('2.1.5');
  });

  it('depois da 2.0.0 o fluxo volta ao normal: tag e package.json andam juntos', () => {
    expect(nextVersion('v2.0.0', '2.0.0')).toBe('2.0.1');
  });

  it('versao fora do formato X.Y.Z falha em vez de chutar', () => {
    expect(() => nextVersion('v1.0', '1.0.0')).toThrow();
    expect(() => nextVersion('v1.0.17', '2.0.0-beta.1')).toThrow();
  });
});
