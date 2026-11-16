import { useEffect, useState } from 'react';

export type Ruta = { pantalla: 'venta' } | { pantalla: 'admin'; seccion: string };

function parsear(path: string): Ruta {
  const limpio = path.replace(/\/+$/, '') || '/';
  if (limpio === '/' || limpio === '') return { pantalla: 'venta' };
  if (limpio === '/admin' || limpio.startsWith('/admin/')) {
    const seccion = limpio.slice('/admin'.length).replace(/^\//, '') || 'resumen';
    return { pantalla: 'admin', seccion };
  }
  return { pantalla: 'venta' };
}

export function useRuta(): Ruta {
  const [ruta, setRuta] = useState(() => parsear(window.location.pathname));
  useEffect(() => {
    const onPop = () => setRuta(parsear(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return ruta;
}

export function irA(path: string): void {
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
