// Globais do vitest (`globals: true`): `.cjs` não pode importar `vitest` (ver tests/CLAUDE.md).
const { steamProfileXmlUrl, parseSteamProfileXml } = require('../../electron/steamProfile.cjs');

/** Formato da resposta da Steam em 2026-11-19, com nome e hashes de foto trocados. */
const PROFILE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><profile>
	<steamID64>76561198060265729</steamID64>
	<steamID><![CDATA[Jogador Anonimo]]></steamID>
	<onlineState>online</onlineState>
	<privacyState>public</privacyState>
	<avatarIcon><![CDATA[https://avatars.fastly.steamstatic.com/abc.jpg]]></avatarIcon>
	<avatarFull><![CDATA[https://avatars.fastly.steamstatic.com/abc_full.jpg]]></avatarFull>
	<customURL><![CDATA[anonimo]]></customURL>
</profile>`;

describe('steamProfileXmlUrl', () => {
  it('só monta URL para SteamID64', () => {
    expect(steamProfileXmlUrl('76561198060265729')).toBe('https://steamcommunity.com/profiles/76561198060265729?xml=1');
    for (const bad of ['100000001', '7656119806026572', '76561198060265729/../x', '', null, undefined, 'abc']) {
      expect(steamProfileXmlUrl(bad)).toBeNull();
    }
  });
});

describe('parseSteamProfileXml', () => {
  it('lê nome e foto do perfil', () => {
    expect(parseSteamProfileXml(PROFILE_XML)).toEqual({
      found: true,
      personaname: 'Jogador Anonimo',
      avatar: 'https://avatars.fastly.steamstatic.com/abc_full.jpg',
    });
  });

  it('perfil inexistente é found: false', () => {
    const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><response><error><![CDATA[The specified profile could not be found.]]></error></response>';
    expect(parseSteamProfileXml(xml)).toEqual({ found: false });
  });

  it('foto fora de host da Valve ou sem https é descartada', () => {
    for (const url of ['http://avatars.steamstatic.com/a.jpg', 'https://evil.example/a.jpg', 'https://steamstatic.com.evil.example/a.jpg', 'javascript:alert(1)']) {
      const xml = PROFILE_XML.replace('https://avatars.fastly.steamstatic.com/abc_full.jpg', url);
      expect(parseSteamProfileXml(xml)).toMatchObject({ found: true, avatar: null });
    }
  });

  it('resposta que não é perfil nem erro conhecido é null (indisponível)', () => {
    for (const body of ['', '<html>Rate limited</html>', '<profile></profile>', null]) {
      expect(parseSteamProfileXml(body)).toBeNull();
    }
  });
});
