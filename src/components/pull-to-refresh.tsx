"use client";

import { useState, useRef, ReactNode } from "react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const isPulling = useRef(false);

  const THRESHOLD = 70;

  function handleTouchStart(e: React.TouchEvent) {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isPulling.current || refreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (diff > 0 && window.scrollY === 0) {
      // Aplica resistência de arrasto
      const resistance = Math.min(diff * 0.45, 100);
      setPullY(resistance);
    }
  }

  async function handleTouchEnd() {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullY >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullY(60);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullY(0);
      }
    } else {
      setPullY(0);
    }
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative min-h-full"
    >
      {/* Indicador Visual de Puxar para Atualizar */}
      {(pullY > 0 || refreshing) && (
        <div
          style={{ height: `${pullY}px` }}
          className="flex items-center justify-center overflow-hidden transition-all duration-150 ease-out bg-emerald-50 text-emerald-800"
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <span
              className={`inline-block text-base transition-transform ${
                refreshing
                  ? "animate-spin"
                  : pullY >= THRESHOLD
                  ? "rotate-180"
                  : ""
              }`}
            >
              {refreshing ? "🔄" : "⬇️"}
            </span>
            <span>
              {refreshing
                ? "Atualizando dados…"
                : pullY >= THRESHOLD
                ? "Solte para atualizar"
                : "Puxe para atualizar"}
            </span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
