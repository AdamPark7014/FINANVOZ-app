import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prospectos } from './Prospectos';
import { etiquetaSiguientePaso } from './prospectosFecha';
import type { CapaDatos, Prospecto, SesionAdmin } from './datos';

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

function prospecto(parcial: Partial<Prospecto> & Pick<Prospecto, 'id' | 'nombre' | 'etapa'>): Prospecto {
  return {
    contacto: '',
    telefono: '',
    correo: '',
    origen: 'llamada',
    interes: 'licencias',
    motivo_perdida: null,
    vendedor_id: sesion.usuarioId,
    siguiente_paso: 'Llamar',
    siguiente_paso_en: '2026-11-22',
    cliente_id: null,
    ...parcial,
  };
}

describe('etiquetaSiguientePaso', () => {
  const hoy = '2026-11-22';
  it('hoy, mañana, atrasado y fecha corta', () => {
    expect(etiquetaSiguientePaso(null, hoy)).toBe('');
    expect(etiquetaSiguientePaso('2026-11-22', hoy)).toBe('Hoy');
    expect(etiquetaSiguientePaso('2026-11-23', hoy)).toBe('Mañana');
    expect(etiquetaSiguientePaso('2026-11-21', hoy)).toMatch(/Atrasado/);
    expect(etiquetaSiguientePaso('2026-11-30', hoy)).toMatch(/30/);
  });
});

describe('Prospectos', () => {
  it('lista nuevos con acciones', async () => {
    const datos = capaParcial({
      listarProspectos: vi.fn(async () => ({
        ok: true as const,
        datos: [prospecto({ id: 'p1', nombre: 'Abarrotes Doña Chela', etapa: 'nuevo' })],
      })),
    });
    render(<Prospectos datos={datos} sesion={sesion} onRegistrarVenta={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Abarrotes Doña Chela')).toBeTruthy());
    expect(screen.getByRole('button', { name: /ya lo contacté/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /marcar perdido/i })).toBeTruthy();
  });

  it('avanza etapa con un toque', async () => {
    const actualizar = vi.fn(async () => ({
      ok: true as const,
      datos: prospecto({ id: 'p1', nombre: 'Abarrotes Doña Chela', etapa: 'contactado' }),
    }));
    const datos = capaParcial({
      listarProspectos: vi.fn(async () => ({
        ok: true as const,
        datos: [prospecto({ id: 'p1', nombre: 'Abarrotes Doña Chela', etapa: 'nuevo' })],
      })),
      actualizarEtapaProspecto: actualizar,
    });
    render(<Prospectos datos={datos} sesion={sesion} onRegistrarVenta={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Abarrotes Doña Chela')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /ya lo contacté/i }));
    await waitFor(() => expect(actualizar).toHaveBeenCalledWith('p1', 'contactado', undefined));
  });

  it('marca perdido con hoja y motivo opcional', async () => {
    const actualizar = vi.fn(async () => ({
      ok: true as const,
      datos: prospecto({
        id: 'p1',
        nombre: 'Abarrotes Doña Chela',
        etapa: 'perdido',
        motivo_perdida: 'Sin presupuesto',
      }),
    }));
    const datos = capaParcial({
      listarProspectos: vi.fn(async () => ({
        ok: true as const,
        datos: [prospecto({ id: 'p1', nombre: 'Abarrotes Doña Chela', etapa: 'nuevo' })],
      })),
      actualizarEtapaProspecto: actualizar,
    });
    render(<Prospectos datos={datos} sesion={sesion} onRegistrarVenta={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('Abarrotes Doña Chela')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /^marcar perdido$/i }));
    const dialog = await waitFor(() => screen.getByRole('dialog'));
    fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'Sin presupuesto' } });
    fireEvent.click(dialog.querySelector('button.btn-peligro')!);
    await waitFor(() => expect(actualizar).toHaveBeenCalledWith('p1', 'perdido', 'Sin presupuesto'));
  });

  it('ganado convierte y abre registrar venta', async () => {
    const onRegistrarVenta = vi.fn();
    const convertir = vi.fn(async () => ({
      ok: true as const,
      datos: {
        cliente: {
          id: 'c1',
          nombre: 'Abarrotes Doña Chela',
          rfc: null,
          tipo: 'negocio',
          contacto: '',
          telefono: '',
          correo: '',
          vendedor_id: sesion.usuarioId,
          notas: '',
        },
        prospecto: prospecto({ id: 'p1', nombre: 'Abarrotes Doña Chela', etapa: 'ganado', cliente_id: 'c1' }),
      },
    }));
    const datos = capaParcial({
      listarProspectos: vi.fn(async () => ({
        ok: true as const,
        datos: [prospecto({ id: 'p1', nombre: 'Abarrotes Doña Chela', etapa: 'propuesta' })],
      })),
      convertirProspectoEnCliente: convertir,
    });
    // filtro por defecto es «nuevo»; cambiar a Propuesta
    render(<Prospectos datos={datos} sesion={sesion} onRegistrarVenta={onRegistrarVenta} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /propuesta/i })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /^Propuesta/i }));
    await waitFor(() => expect(screen.getByText('Abarrotes Doña Chela')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /^ganado$/i }));
    await waitFor(() => expect(convertir).toHaveBeenCalledWith('p1'));
    expect(onRegistrarVenta).toHaveBeenCalledWith('c1');
  });

  it('vacío en nuevos', async () => {
    const datos = capaParcial({
      listarProspectos: vi.fn(async () => ({ ok: true as const, datos: [] })),
    });
    render(<Prospectos datos={datos} sesion={sesion} onRegistrarVenta={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/hablar con un asesor/i)).toBeTruthy());
  });

  it('error con Reintentar', async () => {
    const datos = capaParcial({
      listarProspectos: vi.fn(async () => ({ ok: false as const, error: 'Falló la red', codigo: 'red' as const })),
    });
    render(<Prospectos datos={datos} sesion={sesion} onRegistrarVenta={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/falló la red/i)).toBeTruthy());
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeTruthy();
  });
});
