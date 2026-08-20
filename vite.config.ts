import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

import type { Plugin } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Content-Security-Policy aplicada apenas ao bundle de producao.
//
// Nao usamos uma <meta> fixa no index.html porque em dev o @vitejs/plugin-react
// injeta o preamble do React Refresh como script inline, o que exigiria
// script-src 'unsafe-inline' e enfraqueceria a politica tambem em producao.
// Os hosts abaixo sao exatamente os que o app consome:
//   - api.stratz.com   : GraphQL (o renderer chama direto, nao so via IPC)
//   - api.opendota.com : perfis, duplas, busca por vanity URL
//   - *.steamstatic.com: avatares e icones de heroi/item
//   - www.opendota.com : icones de rank
//   - fonts.google*    : Inter e JetBrains Mono
// style-src precisa de 'unsafe-inline' porque varios componentes usam o
// atributo style={{ ... }} do React.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // www.opendota.com serve os icones de rank (src/constants/ranks.ts)
  "img-src 'self' data: https://cdn.cloudflare.steamstatic.com https://avatars.steamstatic.com https://www.opendota.com",
  "connect-src 'self' https://api.stratz.com https://api.opendota.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
].join('; ')

function cspPlugin(): Plugin {
  return {
    name: 'glimpsegg-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
            injectTo: 'head-prepend',
          },
        ],
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cspPlugin(),
  ],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
