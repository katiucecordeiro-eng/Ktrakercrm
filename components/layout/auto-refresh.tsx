"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 30_000;

// Refaz o fetch dos dados dos Server Components da rota atual — sem isso,
// quem deixa o dashboard aberto numa aba só vê dados novos depois de um
// F5 manual. Atualiza sozinho de tempos em tempos e sempre que a aba volta
// a ficar visível/em foco (ex.: usuária troca de aba e volta).
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => router.refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);

    function handleVisibility() {
      if (document.visibilityState === "visible") refresh();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", refresh);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  return null;
}
