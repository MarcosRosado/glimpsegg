# GlimpseGG

Aplicativo desktop de análise pós-jogo de Dota 2. Cruza dados da STRATZ e da OpenDota para
transformar um replay já encerrado em leitura tática: benchmarks por herói e posição, timeline de
vantagem, mapa de visão e insights acionáveis por jogador.

Construído com Electron + React + TypeScript + Vite. Interface em português (pt-BR) e inglês (en-US).

## Recursos

**Dashboard do jogador**
- Perfil, rank e forma recente
- Lista de partidas com resumo por jogo
- Heróis mais jogados e tendência de performance
- Heatmap de atividade
- Matriz de duplas e tendências vindas da STRATZ

**Análise de partida** — quatro abas por jogador
- `OVERVIEW` — scoreboard, visão geral dos times, timeline de vantagem
- `PERFORMANCE` — métricas contra baseline de herói/posição
- `VISION` — posicionamento de wards no minimapa
- `COACHING` — insights automáticos derivados das métricas da partida

## Requisitos

- Node.js 20+ (desenvolvido em 24.x)
- npm 10+

## Instalação

Baixe o binário da sua plataforma na página de [Releases](https://github.com/MarcosRosado/glimpsegg/releases):

| Plataforma | Artefato |
| --- | --- |
| Windows | `GlimpseGG-Setup-<versão>-x64.exe` (instalador) ou `GlimpseGG-Portable-<versão>-x64.exe` |
| Linux | `GlimpseGG-<versão>-linux-x86_64.AppImage` |
| macOS | `GlimpseGG-<versão>-mac-<arch>.dmg` |

O app se atualiza sozinho a partir das Releases deste repositório.

## Token da STRATZ

O token é **opcional**. Sem ele o app abre em um dataset de demonstração (o badge no topo mostra
`Demo` em vez de `Live`).

Para usar dados reais:

1. Gere um token em <https://stratz.com/api>.
2. Cole no onboarding da primeira execução, ou depois em **Settings → STRATZ API Token**.
3. O Steam Account ID é extraído automaticamente do claim `SteamId` do próprio token — não precisa
   digitar.

> [!WARNING]
> **O token pessoal da STRATZ não pode ser revogado.** Se ele vazar, permanece válido até a data de
> expiração embutida no JWT. Nunca commite o token, nem cole em issues, pull requests ou prints de
> tela. Ele é um Bearer token: quem tiver o valor consome a sua quota de API.

### Onde o token é armazenado

Em texto claro, **localmente**, sem criptografia:

- **Desktop:** `stratz_app_config.json` dentro do diretório `userData` do Electron
  (`~/.config/GlimpseGG` no Linux, `%APPDATA%\GlimpseGG` no Windows,
  `~/Library/Application Support/GlimpseGG` no macOS).
- **Browser (dev):** `localStorage`, chave `stratz_api_key`.

O token nunca é embutido no bundle nem nos artefatos de release — ele só existe na máquina de quem
executa o app. Ainda assim, trate a máquina como o limite de confiança: qualquer processo com acesso
ao seu perfil de usuário consegue ler esse arquivo.

## Desenvolvimento

```bash
npm install
cp .env.example .env     # opcional — o token também pode ser inserido pela UI
npm run electron:dev     # Vite + Electron com HMR
```

Outros scripts:

| Script | O que faz |
| --- | --- |
| `npm run dev` | Só o Vite, no browser (sem as APIs do Electron) |
| `npm run build` | Type-check (`tsc -b`) + bundle de produção |
| `npm run electron:start` | Electron sobre o bundle já compilado |
| `npm run electron:test-clean` | Electron com `userData` isolado, para testar o onboarding do zero |
| `npm run dist` | Empacota AppImage para Linux |
| `npm run dist:all` | Empacota macOS + Windows + Linux |

### Fontes de dados

- **STRATZ** (GraphQL, `api.stratz.com`) — detalhes de partida, benchmarks, tendências. Requer token.
- **OpenDota** (REST, `api.opendota.com`) — perfis, duplas, busca por vanity URL. Público, sem chave.

## Releases

Todo push na `main` incrementa a versão patch, cria a tag e publica uma release com os artefatos das
três plataformas, via GitHub Actions.

## Contato

Marcos Rosado — <contato@marcosrosado.dev>

Bugs e sugestões: abra uma [issue](https://github.com/MarcosRosado/glimpsegg/issues).
Nunca inclua seu token da STRATZ em issues, logs ou prints.

## Licença

MIT — veja [LICENSE](LICENSE).
