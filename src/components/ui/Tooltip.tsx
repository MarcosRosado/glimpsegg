import React, { useCallback, useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Tooltip posicionado. A primeira do projeto — o resto do app usa o `title` nativo.
 *
 * ## Por que PORTAL, e nao um popover absoluto dentro do ancora
 *
 * A replica do grid desenha os grupos dentro de um `transform: scale()`
 * (`HeroGridMirrorScreen`), e um ancestral transformado vira o bloco contentor de
 * `position: fixed`. Um popover ancorado la dentro sairia posicionado a partir da caixa
 * transformada E encolhido junto com ela — ilegivel exatamente na janela estreita, que é
 * quando a escala cai abaixo de 1. Fora, num portal para o `body`, nada disso alcanca:
 * `getBoundingClientRect()` do ancora ja devolve coordenadas de viewport POS-transform,
 * que é o sistema em que `fixed` trabalha.
 *
 * Testar em escala < 1 (janela abaixo de ~1990px uteis) é obrigatorio: em escala 1 o bug
 * nao aparece.
 *
 * ## Teclado e leitor de tela
 *
 * Abre no foco tambem, e nao só no hover: um tooltip que so responde ao mouse esconde a
 * procedencia do numero de quem navega por Tab. `aria-describedby` liga os dois, e o
 * conteudo fica com `role="tooltip"`.
 */

/** Atraso do hover. Curto o bastante para nao parecer travado, longo para nao piscar ao passar reto. */
const OPEN_DELAY_MS = 120;
/** Folga da borda da viewport, para o popover nunca encostar. */
const VIEWPORT_MARGIN = 8;
/** Distancia entre o ancora e o popover. */
const ANCHOR_GAP = 8;

interface TooltipProps {
  /** O conteudo do balao. Ausente ou `null` desliga o tooltip e o ancora vira um elemento comum. */
  content: React.ReactNode;
  children: React.ReactNode;
  /** Classes do elemento ancora — ele é o proprio wrapper, sem `<span>` extra no meio. */
  className?: string;
}

interface Coords {
  top: number;
  left: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, className }) => {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  /** Bump de rolagem/resize: é o que faz o layout effect remedir sem fechar o balao. */
  const [tick, setTick] = useState(0);
  const id = useId();

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const close = useCallback(() => {
    clearTimer();
    setOpen(false);
    setCoords(null);
  }, []);

  const openNow = useCallback(() => {
    clearTimer();
    setOpen(true);
  }, []);

  const openSoon = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
  }, []);

  useEffect(() => clearTimer, []);

  /**
   * A medicao acontece DEPOIS do balao existir, num layout effect: sem a largura real nao
   * da para decidir se ele cabe à direita, e chutar um valor produziria justamente o
   * tooltip cortado na borda que o `title` nativo nunca teve.
   */
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const bubble = bubbleRef.current;
    if (!anchor || !bubble) return;

    const a = anchor.getBoundingClientRect();
    const b = bubble.getBoundingClientRect();

    // Abaixo por padrao; acima quando nao cabe embaixo e cabe em cima.
    const below = a.bottom + ANCHOR_GAP;
    const above = a.top - b.height - ANCHOR_GAP;
    const fitsBelow = below + b.height + VIEWPORT_MARGIN <= window.innerHeight;
    const preferred = fitsBelow || above < VIEWPORT_MARGIN ? below : above;
    // Com o ancora perto (ou fora) da borda, nenhum dos dois lados cabe inteiro — ai o
    // balao é PRESO na viewport em vez de vazar. Sem este clamp ele saia pela borda de
    // baixo justamente no caso que o motivou: tile abaixo da dobra, alcancado por Tab.
    const maxTop = window.innerHeight - b.height - VIEWPORT_MARGIN;
    const top = Math.max(VIEWPORT_MARGIN, Math.min(preferred, Math.max(VIEWPORT_MARGIN, maxTop)));

    // Centralizado no ancora, preso dentro da viewport.
    const centered = a.left + a.width / 2 - b.width / 2;
    const maxLeft = window.innerWidth - b.width - VIEWPORT_MARGIN;
    const left = Math.max(VIEWPORT_MARGIN, Math.min(centered, Math.max(VIEWPORT_MARGIN, maxLeft)));

    setCoords((prev) =>
      prev && prev.top === top && prev.left === left ? prev : { top, left },
    );
  }, [open, content, tick]);

  /**
   * Escape fecha; rolagem e resize REPOSICIONAM.
   *
   * Fechar na rolagem parecia mais simples e estava errado: dar foco a um tile abaixo da
   * dobra faz o navegador rolar o elemento para a vista, o que disparava o `scroll` e
   * fechava o balao no mesmo quadro em que ele abria — o tooltip so funcionava de teclado
   * para o que ja estava visivel. Reposicionar custa uma medicao por quadro de rolagem,
   * amortizada por `requestAnimationFrame`.
   */
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const reposition = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setTick((n) => n + 1);
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, close]);

  if (!content) return <div className={className}>{children}</div>;

  return (
    <>
      <div
        ref={anchorRef}
        className={className}
        tabIndex={0}
        aria-describedby={open ? id : undefined}
        onMouseEnter={openSoon}
        onMouseLeave={close}
        onFocus={openNow}
        onBlur={close}
      >
        {children}
      </div>

      {open &&
        createPortal(
          <div
            ref={bubbleRef}
            id={id}
            role="tooltip"
            style={{
              position: 'fixed',
              top: coords?.top ?? 0,
              left: coords?.left ?? 0,
              // Antes da primeira medicao o balao ja existe no DOM (é ela que o mede), mas
              // ainda esta na posicao errada. Invisivel ate la, em vez de piscar no canto.
              visibility: coords ? 'visible' : 'hidden',
            }}
            className="z-[60] max-w-[min(20rem,calc(100vw-1rem))] pointer-events-none rounded-xl border border-slate-700 bg-[#0d1320] px-3 py-2.5 shadow-2xl shadow-black/60"
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
};
