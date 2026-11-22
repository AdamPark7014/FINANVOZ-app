import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Clientes } from './Clientes';
import type { CapaDatos, Cliente, SesionAdmin } from './datos';

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

const cliente: Cliente = {
  id: 'c1',
  nombre: 'Estética Lupita',
  rfc: 'EALU800101XXX',
  tipo: 'negocio',
  contacto: 'Lupita',
  telefono: '2221112233',
  correo: 'lupita@ejemplo.mx',
  vendedor_id: sesion.usuarioId,
  notas: '',
};

describe('Clientes', () => {
  it('lista clientes y abre ficha', async () => {
    const datos = capaParcial({
      listarClientes: vi.fn(async () => ({ ok: true as const, datos: [cliente] })),
      ventasDeCliente: vi.fn(async () => ({ ok: true as const, datos: [] })),
    });
    render(<Clientes datos={datos} sesion={sesion} onRegistrarVenta={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Estética Lupita')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Estética Lupita' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(screen.getByRole('heading', { name: 'Estética Lupita' })).toBeTruthy();
    expect(screen.getByText(/RFC EALU800101XXX/)).toBeTruthy();
  });

  it('vacío con acción nuevo cliente', async () => {
    const datos = capaParcial({
      listarClientes: vi.fn(async () => ({ ok: true as const, datos: [] })),
    });
    render(<Clientes datos={datos} sesion={sesion} onRegistrarVenta={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/aún no hay clientes/i)).toBeTruthy());
    expect(screen.getAllByRole('button', { name: /nuevo cliente/i }).length).toBeGreaterThan(0);
  });

  it('error con Reintentar', async () => {
    const datos = capaParcial({
      listarClientes: vi.fn(async () => ({ ok: false as const, error: 'Falló la red', codigo: 'red' as const })),
    });
    render(<Clientes datos={datos} sesion={sesion} onRegistrarVenta={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/falló la red/i)).toBeTruthy());
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeTruthy();
  });
});

