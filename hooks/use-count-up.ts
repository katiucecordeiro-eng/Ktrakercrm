"use client";

import { useEffect, useRef, useState } from "react";

// Anima um número de 0 até o valor na primeira renderização, e depois só
// anima a partir do valor anterior real quando ele muda de fato — evita
// que o AutoRefresh (router.refresh() a cada 30s) reinicie a animação do
// zero toda vez que a página recarrega os dados, mesmo quando o valor é
// idêntico ao que já estava na tela.
export function useCountUp(target: number, durationMs = 600): number {
  const [display, setDisplay] = useState(target);
  const previousTarget = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = previousTarget.current ?? 0;
    previousTarget.current = target;

    if (from === target) {
      setDisplay(target);
      return;
    }

    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return display;
}
