import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Resumen } from './Resumen';
import type { CapaDatos, SesionAdmin } from './datos';

afterEach(() => cleanup());

const sesion: SesionAdmin = {
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
    actualizarEtapaProspecto: vi.fn(),
    convertirProspectoEnCliente: vi.fn(),
    listarClientes: vi.fn(),
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
  };
  return { ...base, ...parcial } as CapaDatos;
}

describe('Resumen', () => {
  it('muestra cifras con datos falsos de la capa', async () => {
    const datos = capaParcial({
      resumen: vi.fn(async () => ({
        ok: true as const,
        datos: {
          mes: '2026-11-01',
          ingreso_cobrado_centavos: 150000,
          ingreso_plus_centavos: 99000,
          ingreso_licencias_centavos: 51000,
          por_cobrar_centavos: 20000,
          ventas: 3,
          prospectos_por_etapa: { nuevo: 2 },
          tasa_cierre: 40,
          prospectos_abiertos: 2,
          plus_activos: 1,
          usuarios_activos_7d: 5,
        },
      })),
      ultimasVentas: vi.fn(async () => ({
        ok: true as const,
        datos: [
          {
            id: '1',
            folio: 'FV-0001',
            cliente_id: 'c',
            vendedor_id: sesion.usuarioId,
            producto: 'plus_mensual',
            cantidad: 1,
            meses: 1,
            precio_unitario_centavos: 9900,
            total_centavos: 9900,
            estado: 'pagada',
            vence_en: null,
            pagada_en: null,
            cancelada_motivo: null,
            creado_en: '2026-11-01T18:00:00Z',
            cliente_nombre: 'Estética Lupita',
            vendedor_nombre: 'Vendedor 2',
          },
        ],
      })),
      comisiones: vi.fn(async () => ({
        ok: true as const,
        datos: [
          {
            mes: '2026-11-01',
            vendedor_id: sesion.usuarioId,
            vendedor_nombre: 'Adam',
            vendido_centavos: 150000,
            cobrado_centavos: 150000,
            por_cobrar_centavos: 0,
            comision_centavos: 0,
            meta_mensual_centavos: 200000,
          },
        ],
      })),
      pendientesHoy: vi.fn(async () => ({
        ok: true as const,
        datos: { ventasPorVencer: [], pasosVencidos: [] },
      })),
    });

    render(<Resumen datos={datos} sesion={sesion} />);
    expect(screen.getByLabelText(/cargando/i)).toBeTruthy();
    await waitFor(() => expect(screen.getByText(/lo que entró este mes/i)).toBeTruthy());
    expect(screen.getAllByText('$1,500').length).toBeGreaterThan(0);
    expect(screen.getByText('$200')).toBeTruthy();
    expect(screen.getByText('Estética Lupita')).toBeTruthy();
    expect(screen.getByText(/Folio FV-0001 · 1 nov/)).toBeTruthy();
    // El dueño ve la columna de vendedor y las cifras de toda la app.
    expect(screen.getByRole('columnheader', { name: 'Vendedor' })).toBeTruthy();
    expect(screen.getByText(/plus activos en la app/i)).toBeTruthy();
  });

  it('un vendedor no ve cifras de toda la app ni la columna de vendedor', async () => {
    const datos = capaParcial({
      resumen: vi.fn(async () => ({
        ok: true as const,
        datos: {
          mes: '2026-11-01',
          ingreso_cobrado_centavos: 0,
          ingreso_plus_centavos: 0,
          ingreso_licencias_centavos: 0,
          por_cobrar_centavos: 0,
          ventas: 2,
          prospectos_por_etapa: {},
          tasa_cierre: 0,
          prospectos_abiertos: 0,
          plus_activos: 0,
          usuarios_activos_7d: 0,
        },
      })),
      ultimasVentas: vi.fn(async () => ({ ok: true as const, datos: [] })),
      comisiones: vi.fn(async () => ({ ok: true as const, datos: [] })),
      pendientesHoy: vi.fn(async () => ({
        ok: true as const,
        datos: { ventasPorVencer: [], pasosVencidos: [] },
      })),
    });
    render(<Resumen datos={datos} sesion={{ ...sesion, rol: 'vendedor', nombre: 'Vendedor 1' }} />);
    await waitFor(() => expect(screen.getByText(/ventas del mes/i)).toBeTruthy());
    expect(screen.queryByText(/plus activos en la app/i)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Tu mes' })).toBeTruthy();
  });

  it('estado vacío cuando no hay movimiento', async () => {
    const datos = capaParcial({
      resumen: vi.fn(async () => ({
        ok: true as const,
        datos: {
          mes: '2026-11-01',
          ingreso_cobrado_centavos: 0,
          ingreso_plus_centavos: 0,
          ingreso_licencias_centavos: 0,
          por_cobrar_centavos: 0,
          ventas: 0,
          prospectos_por_etapa: {},
          tasa_cierre: 0,
          prospectos_abiertos: 0,
          plus_activos: 0,
          usuarios_activos_7d: 0,
        },
      })),
      ultimasVentas: vi.fn(async () => ({ ok: true as const, datos: [] })),
      comisiones: vi.fn(async () => ({ ok: true as const, datos: [] })),
      pendientesHoy: vi.fn(async () => ({
        ok: true as const,
        datos: { ventasPorVencer: [], pasosVencidos: [] },
      })),
    });
    render(<Resumen datos={datos} sesion={sesion} />);
    await waitFor(() => expect(screen.getByText(/todavía no hay ventas/i)).toBeTruthy());
    expect(screen.getAllByRole('button', { name: /registrar venta/i }).length).toBeGreaterThan(0);
  });

  it('estado de error con Reintentar', async () => {
    const datos = capaParcial({
      resumen: vi.fn(async () => ({ ok: false as const, error: 'Falló la red', codigo: 'red' as const })),
      ultimasVentas: vi.fn(async () => ({ ok: true as const, datos: [] })),
      comisiones: vi.fn(async () => ({ ok: true as const, datos: [] })),
      pendientesHoy: vi.fn(async () => ({
        ok: true as const,
        datos: { ventasPorVencer: [], pasosVencidos: [] },
      })),
    });
    render(<Resumen datos={datos} sesion={sesion} />);
    await waitFor(() => expect(screen.getByText(/falló la red/i)).toBeTruthy());
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeTruthy();
  });
});
