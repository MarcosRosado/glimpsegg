#!/usr/bin/env bash
# Rotina diaria da coleta do gabarito, feita para rodar sozinha por agendador
# (docs/COLETA-GABARITO.md, secao "Agendamento"). Faz o que o roteiro manda fazer a mao:
# colhe 7.42, roda o aceite da Fase 1, o criterio de corte, o agregador de benchmarks e a
# regua do Glint, e guarda tudo em
# .gabarito/logs/AAAA-MM-DD.log.
#
#   GABARITO_UNTIL=2026-12-03   ultimo dia em que a rotina ainda colhe (obrigatorio)
#   WINDOW_MINUTES=180          teto de duracao da coleta do dia (padrao 180)
#   UNTIL_TIME=20:57            hora local em que a coleta tem de PARAR (opcional)
#   APP_RESERVE=500             saldo do dia que a coleta deixa para o app (padrao 150,
#                               o minimo do coletor)
#
# UNTIL_TIME existe para a rotina rodar no fim do dia e gastar so a SOBRA da cota: a OpenDota
# zera o contador a meia-noite UTC (21h de Brasilia), e coleta que passasse disso comecaria a
# gastar a cota do dia seguinte, a do app. Com ele, a janela vai de agora ate essa hora; fora
# de (0, WINDOW_MINUTES] minutos a rotina nao colhe (maquina ligada de manha nao dispara uma
# coleta de doze horas sobre a cota nova).
#
# A JANELA TEM FIM DE PROPOSITO. Depois de GABARITO_UNTIL o script nao colhe mais nada e
# so escreve isso no log: coleta que roda para sempre sem ninguem olhar gasta cota de
# terceiros e enche o disco. Para continuar, alguem tem de decidir e mudar a data.
#
# SO A TRILHA 7.42 desde 2026-11-21. A 7.41 levava metade da cota e ja nao rendia: as celulas
# de 25-40 e 40+ estavam no teto, o Glint e o veredito de rota nao mudavam com mais treino
# (Glint de 823 para 916 partidas: r 0,81 -> 0,82), e o que ela ainda colhia era quase so
# volume de 7.41 (742 de volume para 106 pares no ultimo dia), curva de um patch que o app nao
# usa. Os pares de 7.41 em disco continuam sendo o treino; colher mais e decisao, a mao, com
# `node scripts/collect-pairs.cjs --lane 7.41`.
# `timeout -s INT` encerra como um Ctrl+C: o coletor termina a partida atual e grava o indice.
#
# O token da STRATZ nao passa por aqui: o coletor o le do config do app, como sempre.
set -u
cd "$(dirname "$0")/.."

LOG_DIR=.gabarito/logs
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%F).log"
exec >>"$LOG" 2>&1

echo "=== $(date '+%F %T %z') — rotina diaria ==="
if [ -z "${GABARITO_UNTIL:-}" ]; then
  echo "GABARITO_UNTIL nao definido: a rotina nao roda sem data de fim."
  exit 1
fi
if [[ "$(date +%F)" > "$GABARITO_UNTIL" ]]; then
  echo "janela de coleta encerrada em $GABARITO_UNTIL: nada foi colhido. Mude GABARITO_UNTIL para continuar, ou desligue o agendamento."
  exit 0
fi

MAX_MIN=${WINDOW_MINUTES:-180}
if [ -n "${UNTIL_TIME:-}" ]; then
  END=$(date -d "today $UNTIL_TIME" +%s) || { echo "UNTIL_TIME invalido: $UNTIL_TIME"; exit 1; }
  LEFT_MIN=$(( (END - $(date +%s)) / 60 ))
  if [ "$LEFT_MIN" -le 0 ] || [ "$LEFT_MIN" -gt "$MAX_MIN" ]; then
    echo "fora da janela: faltam ${LEFT_MIN} min ate $UNTIL_TIME (aceito: 1 a $MAX_MIN). Nada foi colhido."
    exit 0
  fi
else
  END=$(( $(date +%s) + MAX_MIN * 60 ))
fi
# Segundos ate o fim da janela, nunca negativo.
secs_left() { local s=$(( END - $(date +%s) )); [ "$s" -gt 0 ] && echo "$s" || echo 0; }
REST_S=$(secs_left)
echo "--- trilha 7.42 (ate $(( REST_S / 60 )) min, ate o saldo do dia chegar em ${APP_RESERVE:-150}) ---"
[ "$REST_S" -gt 0 ] && timeout -s INT -k 60 "${REST_S}s" node scripts/collect-pairs.cjs --reserve "${APP_RESERVE:-150}"
echo "--- aceite da Fase 1 ---"
node scripts/accept-phase1.cjs | sed -n '/^POR FAIXA/,/^acertos/p;/^VEREDITO/,$p'
echo "--- criterio de corte ---"
node scripts/benchmark-coverage.cjs
echo "--- benchmarks proprios (derivado, regravado) ---"
node scripts/build-benchmarks.cjs
echo "--- regua do Glint (docs/PROPOSTA-REGUA-GLINT.md) ---"
node scripts/build-impact-reference.cjs | sed -n '/^1\./,/^  maior desvio/p'
# O modelo antigo, ajustado ao IMP (o GLINT_MODEL ate 2026-11-22), na medida registrada antes
# do reajuste: so 7.42 de depois do PRIMEIRO congelamento. Aposentado, medido para o registro.
echo "--- modelo antigo, ajustado ao IMP (aposentado em 2026-11-22) ---"
node scripts/measure-glint.cjs --model .gabarito/glint-imp-fit-2026-11-19.json --seen .gabarito/glint-seen-2026-11-21.json
# A v5, no ar desde 2026-11-22 por decisao do dono, ANTES desta medida: so partidas de depois do
# segundo congelamento. Sem --model de proposito: mede o GLINT_MODEL do app, que é a v5 colada
# (a paridade com o candidato travado foi conferida na troca). Trocou o modelo do app? Novo
# congelamento antes, e esta linha muda junto (plano, roteiro do Glint).
echo "--- Glint no ar (v5, travado em 2026-11-22) ---"
node scripts/measure-glint.cjs --seen .gabarito/glint-seen-2026-11-21.json,.gabarito/glint-seen-2026-11-22.json
echo "=== $(date '+%F %T %z') — fim ==="
