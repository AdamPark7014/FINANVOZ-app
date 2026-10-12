// Pendiente 58 · tras entrar con el correo o borrar la cuenta de respaldo, Plus sigue al usuario correcto.
import { describe, expect, it } from 'vitest';
import { obtenerPlan } from '../servicios/plan';
import { abrirPrueba } from '../servicios/__pruebas__/base';
import { crearComprasEnMemoria } from './memoria';
import { reidentificarCompras } from './reidentificar';

const T0 = Date.UTC(2026, 9, 11, 18, 0, 0);
const DIA = 86_400_000;

describe('reidentificar las compras', () => {
  it('logIn con el usuario nuevo, restaura compras y guarda el plan', async () => {
    const p = abrirPrueba('2026-10-11');
    p.reloj.fijarInstante(T0);
    const tienda = crearComprasEnMemoria({
      ahora: () => T0,
      estado: { plus: { vigenteHasta: T0 + 20 * DIA, enPrueba: false, renovara: true } },
    });
    await tienda.identificar('anonimo-viejo');
    expect(obtenerPlan(p.ctx).plan).toBe('gratis');

    const vista = await reidentificarCompras(tienda, 'usuario-de-correo', p.ctx);
    expect(tienda.usuario).toBe('usuario-de-correo');
    expect(vista?.plan).toBe('plus');
    expect(obtenerPlan(p.ctx).plan).toBe('plus');
    p.base.cerrar();
  });

  it('sin usuario (sin red al crear el anónimo) no toca nada', async () => {
    const p = abrirPrueba('2026-10-11');
    const tienda = crearComprasEnMemoria();
    expect(await reidentificarCompras(tienda, null, p.ctx)).toBeNull();
    expect(tienda.usuario).toBeNull();
    p.base.cerrar();
  });
});
