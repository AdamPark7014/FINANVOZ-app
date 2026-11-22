import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prospectos } from './Prospectos';
import type { CapaDatos, Prospecto, SesionAdmin } from './datos';

afterEach(() => cleanup());

const sesion: SesionAdmin = {
  usuarioId: '00000000-0000-4000-8000-000000000001',
  correo: 'dueno@ejemplo.mx',
  nombre: 'Adam',
  rol: 'dueno',
};

const prospectoNuevo: Prospecto = {
  id: 'p1',
  nombre: 'Abarrotes Doña Chela',
  contacto: '',
  telefono: '2221112233',
  correo: 'chela@ejemplo.mx',
  origen: 'llamada',
  interes: 'licencias',
  etapa: 'nuevo',
  motivo_perdida: null,
  vendedor_id: sesion.usuarioId,
  siguiente_paso: 'Llamar para presentar Finanvoz',
  siguiente_paso_en: '2026-11-22',
  cliente_id: null,
};

function capaParcial(parcial: Partial<CapaDatos>): CapaDatos {
  const base = {
    iniciarSesion: vi.fn(),
    cerrarSesion: vi.fn(),
    sesionActual: vi.fn(),
    resumen: vi.fn(),
    listarProspectos: vi.fn(async () => ({ ok: true as const, datos: [prospectoNuevo] })),
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

describe('Prospectos', () => {
  it('marca perdido con motivo en la hoja', async () => {
    const actualizar = vi.fn(async () => ({
      ok: true as const,
      datos: { ...prospectoNuevo, etapa: 'perdido', motivo_perdida: 'No contestó' },
    }));
    const listar = vi
      .fn()
      .mockResolvedValueOnce({ ok: true as const, datos: [prospectoNuevo] })
      .mockResolvedValue({
        ok: true as const,
        datos: [{ ...prospectoNuevo, etapa: 'perdido', motivo_perdida: 'No contestó' }],
      });

    const datos = capaParcial({
      listarProspectos: listar,
      actualizarEtapaProspecto: actualizar,
    });

    render(<Prospectos datos={datos} sesion={sesion} onRegistrarVenta={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Abarrotes Doña Chela')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Marcar perdido' }));

    const hoja = await screen.findByRole('dialog');
    fireEvent.change(within(hoja).getByLabelText(/motivo/i), { target: { value: 'No contestó' } });
    fireEvent.click(within(hoja).getByRole('button', { name: 'Marcar perdido' }));

    await waitFor(() => {
      expect(actualizar).toHaveBeenCalledWith('p1', 'perdido', 'No contestó');
    });
  });
});
