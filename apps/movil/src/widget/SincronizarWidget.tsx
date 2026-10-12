import { useEffect } from 'react';
import { obtenerVistaWidget, type VistaWidget } from '../servicios';
import { useVista } from '../sesion/ProveedorSesion';
import { actualizarWidget } from './actualizar';

/**
 * Mantiene el widget al día con la app abierta (`02 §21`: ≤ 5 s después de registrar). Cada escritura pasa por
 * `refrescar()` de la sesión; aquí se vuelve a leer la vista del widget y, si cambió, se pinta de inmediato.
 * Así no hace falta tocar cada caso de uso que escribe en el libro.
 */
export function SincronizarWidget() {
  const vista = useVista((ctx) => {
    try {
      return obtenerVistaWidget(ctx);
    } catch {
      return null;
    }
  });
  // La vista es un objeto nuevo en cada lectura: se compara por contenido para no pintar de más.
  const clave = vista ? JSON.stringify(vista) : null;
  useEffect(() => {
    if (clave) void actualizarWidget(JSON.parse(clave) as VistaWidget);
  }, [clave]);
  return null;
}
