# Voz do app

Como o GlimpseGG escreve. Vale para todo texto de interface (os dois dicionários de
`src/i18n/translations.ts`), notas de versão e qualquer texto que o jogador lê. Não vale para
`CLAUDE.md`, `docs/` e comentários, que são para quem mantém o código.

Decisão do dono em 2026-11-20: o app fala **como a comunidade de Dota fala**, não como um manual.
O texto anterior era longo, formal e com cara de IA: 90 dos 941 textos em pt-BR passavam de 140
caracteres, com 29 travessões, 27 menções a OpenDota/STRATZ e 18 vezes "patrimônio", para
nenhuma de "net worth".

## Quem lê

Um jogador de Dota que acabou de sair de uma partida e quer saber o que aconteceu. Ele conhece o
jogo melhor do que o app. Não quer saber como o app funciona, quer a resposta.

## Seis regras

1. **Fale do jogo, não do app.** O assunto é a lane, a luta e o item, não a API, o cache, o
   parser, a cota ou a regra interna. "Analisando o replay" serve. "Pedido na fila da OpenDota,
   consultado com recuo" não serve.
2. **Não se defenda.** "Nenhum dado foi inventado", "o app não adivinha", "nada foi estimado no
   lugar" e "nenhum critério foi medido" explicam a doutrina para quem não pediu. A doutrina
   continua valendo. Quem mostra que o app é honesto é o que ele **mostra** (procedência, seção
   escondida), não o que ele diz sobre si.
3. **Jargão da comunidade.** O glossário abaixo vale para as duas línguas. Na dúvida, use o termo
   que o jogador falaria no voice da party.
4. **Uma ideia por frase, e frase curta.** Corte o que o jogador já sabe e o que a tela já
   mostra. Veja os limites por tipo de texto.
5. **Direto, em "você".** Diagnóstico no indicativo ("Você morreu 6 vezes para burst"),
   conselho no imperativo ("Compre BKB antes dos 25 min"). Sem "considere", "pode ser
   interessante" ou "vale a pena avaliar".
6. **Procedência em meia linha.** Onde a doutrina exige dizer de onde vem o número, diga a
   fonte e o tamanho da amostra, não o método. O método mora em `CLAUDE.md`, nos `docs/` e no
   comentário do código.

## O que a doutrina ainda exige, em forma curta

A [doutrina central](../CLAUDE.md) (nunca inventar dado) não muda. Muda o tamanho do texto que a
cumpre:

| Exigência | Como fica curto |
| --- | --- |
| Glint é **experimental** e sai com procedência | Selo "experimental" e tooltip com o teste, o recorte e o centro: "Nota experimental de 0 a 100, pelos seus percentis no herói (partida inteira, todos os ranks). Centro em 50. Mede quanto você pesou na vitória: no time, ordena os jogadores perto da nossa referência (ρ 0,51; o KDA dá 0,40) em 493 partidas de conferência. Ainda em ajuste." (v5, 2026-11-22; antes citava o r contra o antigo IMP) É a exceção declarada ao teto de tooltip: nenhuma dessas três partes pode sair |
| `ROLE_BASELINE` é **estimativa** | Chip "estimativa", sem parágrafo |
| Bracket `ALL` não é "no seu rank" | "média geral" ou "no seu rank", e nada mais |
| Dado ausente | Esconda a seção. Se o vazio confundir, uma linha: "Sem wards: replay não analisado." |
| Veredito de lane mostra a própria base | O badge leva a diferença de NW e XP. O tooltip diz a regra em uma frase e a concordância em outra, com os placeholders e o recorte ("nas lanes em que as duas apontam um vencedor"), sem arredondar 98,8% para 99% |
| Hero grid ordena por winrate **geral** | A negação fica, porque é o aviso que a tela deve: "Ordem por winrate geral do herói, não por função." |
| Hero grid escreve no arquivo do jogador | "Nada foi escrito" é o resultado da operação, não autodefesa, e fica. Vale para adiar, abortar e bloquear a gravação |

Nas telas cujo assunto **é** o app (privacidade, configurações, sincronização do espelho, "há N
dias sem sincronizar"), a regra 1 não se aplica. Valem só frase curta e nada de método.

Se a regra de honestidade só se cumpre com texto longo, o lugar desse texto é um "Como
calculamos" aberto a pedido, não a tela principal.

## Glossário

Termo do jogo fica no original, como a comunidade fala. Português onde o português já é o natural.

| Use (pt-BR) | Use (en-US) | Evite |
| --- | --- | --- |
| lane, safe lane, mid, off lane | lane, safe lane, mid, off lane | rota, rota segura, rota difícil |
| net worth (NW em espaço curto) | net worth (NW) | patrimônio |
| XP | XP | xp, experiência |
| last hits (LH), denies | last hits (LH), denies | creeps abatidos, abates de creep, negados |
| GPM, XPM, farm, farmar | GPM, XPM, farm | ouro por minuto (por extenso) |
| kills, mortes, assistências, KDA | kills, deaths, assists, KDA | abates |
| pos 1 a pos 5, carry, mid, offlaner, suporte, core | pos 1–5, carry, mid, offlaner, support, core | posição 1, núcleo, HC |
| luta, teamfight | fight, teamfight | confronto |
| gank, rotação, rodar | gank, rotation, rotate | — |
| ward, observer, sentry, dewardar | ward, observer, sentry, deward | observador, sentinela |
| stack, puxar (pull), jungle | stack, pull, jungle | selva, puxada para o creep de longo alcance |
| torre, rax, Roshan, Aegis, buyback | tower, rax, Roshan, Aegis, buyback | recompra, quartel |
| build, item, skill, ult | build, item, skill, ult | habilidade suprema |
| rank, as medalhas como o cliente do Dota as chama | rank, medals as the Dota client names them | ranque, bracket |
| winrate | winrate | taxa de vitória |
| replay, replay analisado | replay, analyzed replay | parse, parseado |
| partida, jogo | match, game | — |
| patch | patch | versão do jogo |

"Glint" é nome próprio e não se traduz. Os vereditos de lane seguem o glossário: Lane dominada,
Lane vencida, Lane equilibrada, Lane perdida, Lane atropelada.

## Tamanho por tipo de texto

Teto em caracteres, já com os placeholders preenchidos por valores típicos. Passar do teto pede
motivo.

| Tipo | Teto | Exemplo |
| --- | --- | --- |
| Rótulo, aba, botão, chip | 3 palavras | "Analisar replay", "Meu jogo" |
| Título de seção ou cartão | 6 palavras | "Destaques da partida" |
| Estado, aviso, vazio | 1 frase, ~100 | "Analisando o replay. A tela atualiza sozinha." |
| Tooltip | 2 frases, ~140 | "Mais kills, com 30% de folga sobre o segundo." |
| Coaching (manchete + corpo) | manchete de 5 palavras, corpo ~160 | "Lane perdida" + "Aos 10 min, seu lado da lane estava atrás na média de NW e XP. Se a lane não segura, rode ou vá farmar a jungle." |

## Tiques proibidos

- **Travessão (—) no texto de tela.** Quase sempre separa uma segunda ideia, que vira outra frase
  ou sai.
- **"Não é X, é Y"** e as variações ("não significa X — significa Y"). Diga Y.
- **Frase de efeito** de manual de autoajuda: "a alavanca mais barata do jogo", "vale mais que
  qualquer item".
- **Explicar a ausência** quando esconder resolve.
- **Repetir o que a tela mostra.** Se o número está ao lado, a frase não o repete por extenso.
- **Hedge**: "pode ter sido", "tipicamente", "costuma", quando o número já diz.
- **Title Case em português.** "Lane perdida", não "Lane Perdida". Em en-US, também sentence case
  ("Lane lost"), para as duas línguas terem a mesma cara.

## Números

- "aos 10 min", "no min 23", "12,4k" (pt-BR) / "12.4k" (en-US). A formatação vem do `language`
  do `LanguageContext`, nunca de literal.
- Porcentagem sem espaço: "62%".
- Diferença com sinal: "+1,2k NW", "−340 XP".

## en-US

Mesma voz, escrita por quem joga em inglês, nunca tradução literal do pt-BR. "Lane lost", não
"Lost lane route". O teto de tamanho vale igual.

## Antes e depois

| Antes | Depois |
| --- | --- |
| Você fechou os 10 primeiros minutos com a rota dominada em patrimônio e xp. Vantagem de rota é a alavanca mais barata do jogo — repetir esse padrão vale mais que qualquer item. | Lane dominada: aos 10 min, seu lado da lane estava bem à frente na média de NW e XP. |
| {cs} creeps aos 10 minutos contra a referência de {benchCs} ({pct}% abaixo). Trabalhe agro de creep, puxada para o creep de longo alcance e evite trocas quando a wave está sob a torre. | {cs} last hits aos 10 min, {pct}% abaixo da referência ({benchCs}). Segure a wave fora da torre e use o agro dos creeps. |
| O replay desta partida ainda não foi analisado pela OpenDota, então não existem eventos de ward para mostrar. Nenhum dado foi inventado para preencher o mapa. | Sem wards: replay não analisado. |
| Recomendação de build, confrontos por herói e coaching minuto a minuto contra a média do herói não aparecem aqui. Eles dependiam de agregados que a OpenDota não tem em volume suficiente… | Build recomendada e matchups voltam numa próxima versão. |

## Ao escrever texto novo

1. Passa no glossário?
2. Cabe no teto do tipo?
3. Fala do jogo ou do app?
4. Tem travessão, "não é X, é Y" ou frase de efeito?
5. A versão en-US foi escrita, não traduzida?
6. **O critério bate com o código?** Encurtar não é só cortar. Antes de reescrever um tooltip
   que descreve regra (margem de prêmio, limiar, janela), confira contra o motor. Texto curto e
   errado é pior que longo e certo.
7. **Quem mais cita o texto antigo?** `grep -rn` do rótulo antigo em `tests/`, nos `CLAUDE.md`,
   nos `docs/` e nos dois README. Texto de tela citado literalmente diverge em silêncio.

## A reescrita de 2026-11-20

O dicionário inteiro foi reescrito nesta voz, nas duas línguas, em oito lotes por tela (Início e
modo placar, Resumo e Lutas, Meu jogo, Visão, Coaching, Conta/Heróis/Partidas, moldura e
onboarding, hero grid). Cada lote conferiu o texto contra o código, e uns 40 textos diziam algo
que o código não faz: prêmios citando o IMP e uma margem que não existe, a régua de "dewardada
cedo", "COMEBACK" sem déficit medido, regras de coaching prometendo mais do que mediam. Texto novo
segue este guia desde a primeira versão, sem esperar outra rodada de reescrita.
