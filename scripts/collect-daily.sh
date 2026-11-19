#!/usr/bin/env bash
# Rotina diaria da coleta do gabarito, feita para rodar sozinha por agendador
# (docs/COLETA-GABARITO.md, secao "Agendamento"). Faz o que o roteiro manda fazer a mao:
# colhe 7.41, colhe 7.42, roda o aceite da Fase 1, o criterio de corte e o agregador de
# benchmarks, e guarda tudo em
# .gabarito/logs/AAAA-MM-DD.log.
#
#   GABARITO_UNTIL=2026-12-03   ultimo dia em que a rotina ainda colhe (obrigatorio)
#   WINDOW_MINUTES=180          teto de duracao da coleta do dia (padrao 180)
#
# A JANELA TEM FIM DE PROPOSITO. Depois de GABARITO_UNTIL o script nao colhe mais nada e
# so escreve isso no log: coleta que roda para sempre sem ninguem olhar gasta cota de
# terceiros e enche o disco. Para continuar, alguem tem de decidir e mudar a data.
#
# A cota do dia (3.000 chamadas da OpenDota) é dividida entre as duas trilhas: a 7.41 para
# quando o saldo chega em 1.500, a 7.42 leva o resto. Cada uma tem metade da janela de tempo.
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

HALF=$(( ${WINDOW_MINUTES:-180} / 2 ))
echo "--- trilha 7.41 (ate ${HALF} min, ate o saldo do dia chegar em 1500) ---"
timeout -s INT -k 120 "${HALF}m" node scripts/collect-pairs.cjs --lane 7.41 --reserve 1500
echo "--- trilha 7.42 (ate ${HALF} min) ---"
timeout -s INT -k 120 "${HALF}m" node scripts/collect-pairs.cjs
echo "--- aceite da Fase 1 ---"
node scripts/accept-phase1.cjs | sed -n '/^POR FAIXA/,/^acertos/p;/^VEREDITO/,$p'
echo "--- criterio de corte ---"
node scripts/benchmark-coverage.cjs
echo "--- benchmarks proprios (derivado, regravado) ---"
node scripts/build-benchmarks.cjs
echo "=== $(date '+%F %T %z') — fim ==="
