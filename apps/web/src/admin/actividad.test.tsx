import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Actividad } from './Actividad';
import { describirActividad, formatearMomentoMexico, type FilaActividad } from './actividadTexto';
import type { CapaDatos, SesionAdmin } from './datos';

afterEach(() => cleanup());

const ahora = new Date('2026-11-15T20:00:00-06:00');

function fila(parcial: Partial<FilaActividad> & Pick<FilaActividad, 'tabla' | 'accion'>): FilaActividad {
  return {
    id: 1,
    registro_id: 'r1',
    antes: null,
    despues: null,
    usuario_id: 'u1',
    usuario_nombre: 'Adam',
    creado_en: '2026-11-15T20:05:00-06:00',
    ...parcial,
  };
}

describe('formatearMomentoMexico', () => {
  it('hoy, ayer y fecha corta', () => {
    expect(formatearMomentoMexico('2026-11-15T20:05:00-06:00', ahora)).toBe('hoy 20:05');
    expect(formatearMomentoMexico('2026-11-14T09:12:00-06:00', ahora)).toBe('ayer 09:12');
    expect(formatearMomentoMexico('2026-11-12T18:40:00-06:00', ahora)).toBe('12 nov 18:40');
  });
});

describe('describirActividad', () => {
  it('marca venta pagada con dinero en centavos', () => {
    const f = fila({
      tabla: 'admin_ventas',
      accion: 'update',
      antes: { folio: 'FV-0004', estado: 'por_cobrar', total_centavos: 960000 },
      despues: { folio: 'FV-0004', estado: 'pagada', total_centavos: 960000 },
    });
    expect(describirActividad(f, ahora)).toBe('Adam marcó FV-0004 como pagada ($9,600) · hoy 20:05');
  });

  it('registra venta', () => {
    const f = fila({
      tabla: 'admin_ventas',
      accion: 'insert',
      usuario_nombre: 'Vendedor 1',
      despues: {
        folio: 'FV-0005',
        cliente_nombre: 'Caja Solidaria Atlixco',
        total_centavos: 600000,
      },
    });
    expect(describirActividad(f, ahora)).toBe(
      'Vendedor 1 registró FV-0005 a Caja Solidaria Atlixco ($6,000) · hoy 20:05',
    );
  });

  it('mueve prospecto de etapa', () => {
    const f = fila({
      tabla: 'admin_prospectos',
      accion: 'update',
      usuario_nombre: 'Vendedor 2',
      antes: { nombre: 'Abarrotes Doña Chela', etapa: 'nuevo' },
      despues: { nombre: 'Abarrotes Doña Chela', etapa: 'contactado' },
    });
    expect(describirActividad(f, ahora)).toBe(
      'Vendedor 2 movió Abarrotes Doña Chela a Contactados · hoy 20:05',
    );
  });

  it('cambia parámetro de precio', () => {
    const f = fila({
      tabla: 'admin_parametros',
      accion: 'update',
      registro_id: 'precio_plus_mensual',
      antes: { clave: 'precio_plus_mensual', valor: 9900 },
      despues: { clave: 'precio_plus_mensual', valor: 11900 },
    });
    expect(describirActividad(f, ahora)).toBe('Adam cambió Plus mensual de $99 a $119 · hoy 20:05');
  });

  it('cancela venta con motivo', () => {
    const f = fila({
      tabla: 'admin_ventas',
      accion: 'update',
      antes: { folio: 'FV-0002', estado: 'por_cobrar', total_centavos: 150000 },
      despues: {
        folio: 'FV-0002',
        estado: 'cancelada',
        total_centavos: 150000,
        cancelada_motivo: 'El cliente pidió esperar a enero',
      },
    });
    expect(describirActividad(f, ahora)).toBe(
      'Adam canceló FV-0002: El cliente pidió esperar a enero · hoy 20:05',
    );
  });

  it('alta de cliente sin usuario', () => {
    const f = fila({
      tabla: 'admin_clientes',
      accion: 'insert',
      usuario_nombre: '',
      usuario_id: null,
      despues: { nombre: 'Estética Lupita' },
    });
    expect(describirActividad(f, ahora)).toBe('Alta de cliente Estética Lupita · hoy 20:05');
  });

  it('página de venta recibe prospecto', () => {
    const f = fila({
      tabla: 'admin_prospectos',
      accion: 'insert',
      usuario_nombre: '',
      usuario_id: null,
      despues: { nombre: 'Panadería La Espiga' },
    });
    expect(describirActividad(f, ahora)).toBe('La página de venta recibió a Panadería La Espiga · hoy 20:05');
  });

  it('formatea $1,500 desde centavos', () => {
    const f = fila({
      tabla: 'admin_ventas',
      accion: 'insert',
      despues: { folio: 'FV-0009', cliente_nombre: 'Cliente', total_centavos: 150000 },
    });
    expect(describirActividad(f, ahora)).toContain('$1,500');
  });
});

const sesionDueno: SesionAdmin = {
  usuarioId: '00000000-0000-4000-8000-000000000001',
  correo: 'dueno@ejemplo.mx',
  nombre: 'Adam',
  rol: 'dueno',
};

function capaParcial(parcial: Partial<CapaDatos>): CapaDatos {
  const base = {
    iniciarSesion: vi.fn(),
    cerrarSesion: vi.fn(),
    sesionActual: vi.fn(),
    resumen: vi.fn(),
    listarProspectos: vi.fn(),
    crearProspecto: vi.fn(),
    actualizarEtapaProspecto: vi.fn(),
    convertirProspectoEnCliente: vi.fn(),
    listarClientes: vi.fn(),
    crearCliente: vi.fn(),
    ventasDeCliente: vi.fn(),
    listarVentas: vi.fn(),
    registrarVenta: vi.fn(),
    marcarVentaPagada: vi.fn(),
    cancelarVenta: vi.fn(),
    comisiones: vi.fn(),
    listarMiembros: vi.fn(),
    guardarMiembro: vi.fn(),
    listarParametros: vi.fn(),
    guardarParametro: vi.fn(),
    parametrosPrecio: vi.fn(),
    pendientesHoy: vi.fn(),
    ultimasVentas: vi.fn(),
    listarActividad: vi.fn(),
  };
  return { ...base, ...parcial } as CapaDatos;
}

describe('Actividad', () => {
  it('muestra las frases de la capa', async () => {
    const datos = capaParcial({
      listarActividad: vi.fn(async () => ({
        ok: true as const,
        datos: [
          fila({
            id: 2,
            tabla: 'admin_ventas',
            accion: 'update',
            antes: { folio: 'FV-0004', estado: 'por_cobrar', total_centavos: 960000 },
            despues: { folio: 'FV-0004', estado: 'pagada', total_centavos: 960000 },
          }),
          fila({
            id: 1,
            tabla: 'admin_prospectos',
            accion: 'update',
            usuario_nombre: 'Vendedor 2',
            antes: { nombre: 'Abarrotes Doña Chela', etapa: 'nuevo' },
            despues: { nombre: 'Abarrotes Doña Chela', etapa: 'contactado' },
          }),
        ],
      })),
    });
    render(<Actividad datos={datos} sesion={sesionDueno} />);
    await waitFor(() => expect(screen.getByText(/marcó FV-0004 como pagada/i)).toBeTruthy());
    expect(screen.getByText(/movió Abarrotes Doña Chela a Contactados/i)).toBeTruthy();
  });

  it('un vendedor ve SinPermiso', () => {
    const datos = capaParcial({ listarActividad: vi.fn() });
    render(<Actividad datos={datos} sesion={{ ...sesionDueno, rol: 'vendedor', nombre: 'Vendedor 1' }} />);
    expect(screen.getByText(/solo para el dueño/i)).toBeTruthy();
    expect(datos.listarActividad).not.toHaveBeenCalled();
  });
});
