import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ventas } from './Ventas';
import type { CapaDatos, SesionAdmin, Venta } from './datos';

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
    listarActividad: vi.fn(),
    crearProspecto: vi.fn(),
    crearCliente: vi.fn(),
  };
  return { ...base, ...parcial } as CapaDatos;
}

const venta: Venta = {
  id: 'v1',
  folio: 'FV-0003',
  cliente_id: 'c1',
  vendedor_id: sesion.usuarioId,
  producto: 'plus_mensual',
  cantidad: 1,
  meses: 1,
  precio_unitario_centavos: 9900,
  total_centavos: 9900,
  estado: 'por_cobrar',
  vence_en: '2026-11-25',
  pagada_en: null,
  cancelada_motivo: null,
  creado_en: '2026-11-15T18:00:00Z',
  cliente_nombre: 'Estética Lupita',
  vendedor_nombre: 'Adam',
};

describe('Ventas', () => {
  it('lista por cobrar con acciones del dueño', async () => {
    const datos = capaParcial({
      listarVentas: vi.fn(async () => ({ ok: true as const, datos: [venta] })),
    });
    render(<Ventas datos={datos} sesion={sesion} />);
    await waitFor(() => expect(screen.getByText('Estética Lupita')).toBeTruthy());
    expect(screen.getByText(/FV-0003/)).toBeTruthy();
    expect(screen.getByText('$99')).toBeTruthy();
    expect(screen.getByRole('button', { name: /marcar pagada/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^cancelar$/i })).toBeTruthy();
  });

  it('marca pagada', async () => {
    const marcar = vi.fn(async () => ({ ok: true as const, datos: { ...venta, estado: 'pagada' } }));
    const datos = capaParcial({
      listarVentas: vi.fn(async () => ({ ok: true as const, datos: [venta] })),
      marcarVentaPagada: marcar,
    });
    render(<Ventas datos={datos} sesion={sesion} />);
    await waitFor(() => expect(screen.getByText('Estética Lupita')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /marcar pagada/i }));
    await waitFor(() => expect(marcar).toHaveBeenCalledWith('v1'));
  });

  it('vendedor no ve cobrar ni cancelar', async () => {
    const datos = capaParcial({
      listarVentas: vi.fn(async () => ({ ok: true as const, datos: [venta] })),
    });
    render(
      <Ventas
        datos={datos}
        sesion={{ ...sesion, rol: 'vendedor', nombre: 'Vendedor 1' }}
      />,
    );
    await waitFor(() => expect(screen.getByText('Estética Lupita')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /marcar pagada/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^cancelar$/i })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Vendedor' })).toBeNull();
  });

  it('vacío por cobrar', async () => {
    const datos = capaParcial({
      listarVentas: vi.fn(async () => ({ ok: true as const, datos: [] })),
    });
    render(<Ventas datos={datos} sesion={sesion} />);
    await waitFor(() => expect(screen.getByText(/no hay nada por cobrar/i)).toBeTruthy());
  });

  it('error con Reintentar', async () => {
    const datos = capaParcial({
      listarVentas: vi.fn(async () => ({ ok: false as const, error: 'Falló la red', codigo: 'red' as const })),
    });
    render(<Ventas datos={datos} sesion={sesion} />);
    await waitFor(() => expect(screen.getByText(/falló la red/i)).toBeTruthy());
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeTruthy();
  });

  it('cancela con hoja y motivo', async () => {
    const cancelar = vi.fn(async () => ({
      ok: true as const,
      datos: { ...venta, estado: 'cancelada', cancelada_motivo: 'Cliente pidió esperar' },
    }));
    const datos = capaParcial({
      listarVentas: vi.fn(async () => ({ ok: true as const, datos: [venta] })),
      cancelarVenta: cancelar,
    });
    render(<Ventas datos={datos} sesion={sesion} />);
    await waitFor(() => expect(screen.getByText('Estética Lupita')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /^cancelar$/i }));
    const dialog = await waitFor(() => screen.getByRole('dialog'));
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'Cliente pidió esperar' } });
    fireEvent.click(dialog.querySelector('button.btn-peligro')!);
    await waitFor(() => expect(cancelar).toHaveBeenCalledWith('v1', 'Cliente pidió esperar'));
  });
});
