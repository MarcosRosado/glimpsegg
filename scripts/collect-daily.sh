#!/usr/bin/env bash
# Rotina diaria da coleta do gabarito, feita para rodar sozinha por agendador
# (docs/COLETA-GABARITO.md, secao "Agendamento"). Faz o que o roteiro manda fazer a mao:
# colhe 7.41, colhe 7.42, roda o aceite da Fase 1, o criterio de corte e o agregador de
# benchmarks, e guarda tudo em
# .gabarito/logs/AAAA-MM-DD.log.
#
#   GABARITO_UNTIL=2026-12-03   ultimo dia em que a rotina ainda colhe (obrigatorio)
#   WINDOW_MINUTES=180          teto de duracao da coleta do dia (padrao 180)
#   UNTIL_TIME=20:57            hora local em que a coleta tem de PARAR (opcional)
#   APP_RESERVE=500             saldo do dia que a trilha 7.42 deixa para o app (padrao 150,
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
# A cota do dia (3.000 chamadas da OpenDota) é dividida entre as duas trilhas: a 7.41 para
# quando o saldo chega em 1.500, a 7.42 leva o resto. A 7.41 tem no maximo metade da janela
# de tempo; a 7.42 vai ate o fim dela (com UNTIL_TIME, a hora de parada).
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
# Segundos ate o fim da janela, nunca negativo. A 7.41 leva no maximo metade; a 7.42 vai ate o fim.
secs_left() { local s=$(( END - $(date +%s) )); [ "$s" -gt 0 ] && echo "$s" || echo 0; }

HALF_S=$(( $(secs_left) / 2 ))
echo "--- trilha 7.41 (ate $(( HALF_S / 60 )) min, ate o saldo do dia chegar em 1500) ---"
[ "$HALF_S" -gt 0 ] && timeout -s INT -k 60 "${HALF_S}s" node scripts/collect-pairs.cjs --lane 7.41 --reserve 1500
REST_S=$(secs_left)
echo "--- trilha 7.42 (ate $(( REST_S / 60 )) min, ate o saldo do dia chegar em ${APP_RESERVE:-150}) ---"
[ "$REST_S" -gt 0 ] && timeout -s INT -k 60 "${REST_S}s" node scripts/collect-pairs.cjs --reserve "${APP_RESERVE:-150}"
echo "--- aceite da Fase 1 ---"
node scripts/accept-phase1.cjs | sed -n '/^POR FAIXA/,/^acertos/p;/^VEREDITO/,$p'
echo "--- criterio de corte ---"
node scripts/benchmark-coverage.cjs
echo "--- benchmarks proprios (derivado, regravado) ---"
node scripts/build-benchmarks.cjs
echo "=== $(date '+%F %T %z') — fim ==="
