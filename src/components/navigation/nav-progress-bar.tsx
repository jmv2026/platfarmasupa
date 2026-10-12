'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function NavProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Quando o caminho ou parâmetros mudam, a navegação foi concluída
  useEffect(() => {
    setLoading(false);
    setProgress(100);
    const timer = setTimeout(() => {
      setProgress(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  // Detetar cliques em links internos para dar feedback instantâneo (< 50ms)
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;
      
      const href = anchor.getAttribute('href');
      if (
        href &&
        href.startsWith('/') &&
        !href.startsWith('//') &&
        !anchor.getAttribute('target') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey
      ) {
        const cleanHref = href.split('?')[0].split('#')[0];
        const cleanPath = pathname.split('?')[0].split('#')[0];

        if (cleanHref !== cleanPath) {
          setLoading(true);
          setProgress(25);
        }
      }
    };

    document.addEventListener('click', handleAnchorClick, { capture: true });
    return () => document.removeEventListener('click', handleAnchorClick, { capture: true });
  }, [pathname]);

  // Avanço suave da barra de progresso durante o carregamento
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setProgress((prev) => (prev < 85 ? prev + Math.floor(Math.random() * 15 + 10) : prev));
      }, 200);
    }
    return () => clearInterval(interval);
  }, [loading]);

  if (progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-sermail-green via-sermail-lime-vibrant to-emerald-400 transition-all duration-200 ease-out shadow-[0_0_10px_rgba(74,222,128,0.7)]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
