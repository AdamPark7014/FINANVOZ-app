import { useEffect } from 'react';
import { AppState } from 'react-native';
import { obtenerVistaWidget, type VistaWidget } from '../servicios';
import { tomarEventosWidget } from '../servicios/widget';
import { useAnalitica } from '../sesion/ProveedorAnalitica';
import { useSesion, useVista } from '../sesion/ProveedorSesion';
import { actualizarWidget } from './actualizar';

/**
 * Mantiene el widget al día con la app abierta (`02 §21`: ≤ 5 s después de registrar). Cada escritura pasa por
 * `refrescar()` de la sesión; aquí se vuelve a leer la vista del widget y, si cambió, se pinta de inmediato.
 * Así no hace falta tocar cada caso de uso que escribe en el libro.
 *
 * También envía los eventos `widget {evento}` que la tarea en segundo plano dejó pendientes (`03 §8`), al montar
 * y cada vez que la app vuelve a primer plano.
 */
export function SincronizarWidget() {
  const { ctx } = useSesion();
  const registrarEvento = useAnalitica();
  const vista = useVista((c) => {
    try {
      return obtenerVistaWidget(c);
    } catch {
      return null;
    }
  });
  // La vista es un objeto nuevo en cada lectura: se compara por contenido para no pintar de más.
  const clave = vista ? JSON.stringify(vista) : null;
  useEffect(() => {
    if (clave) void actualizarWidget(JSON.parse(clave) as VistaWidget);
  }, [clave]);

  useEffect(() => {
    const enviar = () => {
      try {
        for (const evento of tomarEventosWidget(ctx)) {
          registrarEvento({ nombre: 'widget', propiedades: { evento } });
        }
      } catch {
        // La analítica es opcional: un ajuste ilegible no rompe la app.
      }
    };
    enviar();
    const app = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') enviar();
    });
    return () => app.remove();
  }, [ctx, registrarEvento]);
  return null;
}
