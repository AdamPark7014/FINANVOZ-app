import { fireEvent, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';
import {
  aceptarConsentimiento,
  listarPagosPlaneados,
  listarPlanesMsi,
  listarTarjetas,
  type ResultadoTexto,
} from '../../servicios';
import { renderConSesion } from '../principal/__pruebas__/arnes';
import { abrirPruebaPantalla, conEscenario } from '../principal/__pruebas__/base';
import { FormularioTarjetaNueva } from './FormularioTarjetaNueva';
import { PantallaTarjeta } from './PantallaTarjeta';
import { TarjetaConfirmarMsi } from './TarjetaConfirmarMsi';
import {
  BTN_AGREGAR_TARJETA,
  BTN_CORREGIR_SALDO,
  BTN_GUARDAR_SALDO,
  BTN_PAGAR,
  FALTA_TARJETA_MSI,
  MARCA_CAMPO_CON_ERROR,
  TEXTO_CONFIRMAR_QUITAR_PAGO_PLANEADO,
  TEXTO_SIN_TARJETAS_MSI,
} from './textos';

type ConfirmarMsi = Extract<ResultadoTexto, { resultado: 'confirmar_msi' }>;

/** "Compré una tele de 12 mil a 12 meses" dicho sin ninguna tarjeta registrada. */
const msiSinTarjetas: ConfirmarMsi = {
  resultado: 'confirmar_msi',
  motivo: 'cuenta',
  propuesta: {
    entrada: { monto: 1_200_000, meses: 12, categoria: 'hogar', descripcion: 'tele' },
    faltaTarjeta: { motivo: 'no_encontrada', alias: null, candidatas: [] },
  },
};

function e510() {
  const p = conEscenario('e5-10');
  return { ...p, oro: (p.e.cuentas as Record<string, string>).oro as string };
}

describe('Compra a meses sin tarjetas (auditoría B-3 · 1)', () => {
  it('dice "Aún no tienes tarjetas" con "Agregar tarjeta"; al agregarla queda elegida y se puede guardar', () => {
    const p = abrirPruebaPantalla();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    const alAgregar = jest.fn();
    const alGuardar = jest.fn();
    renderConSesion(
      p.ctx,
      <>
        <TarjetaConfirmarMsi
          datos={msiSinTarjetas}
          origen="texto"
          alGuardar={alGuardar}
          alCancelar={jest.fn()}
          alAgregarTarjeta={alAgregar}
        />
        <FormularioTarjetaNueva alGuardar={jest.fn()} alCancelar={jest.fn()} />
      </>,
    );
    expect(screen.getByTestId('msi-sin-tarjetas-texto')).toHaveTextContent(TEXTO_SIN_TARJETAS_MSI);
    expect(screen.getByTestId('boton-guardar-msi')).toHaveProp('accessibilityState', {
      disabled: true,
      busy: false,
    });
    expect(screen.getByTestId('boton-guardar-msi')).toHaveProp('accessibilityHint', FALTA_TARJETA_MSI);
    expect(screen.getByTestId('msi-agregar-tarjeta').props.accessibilityLabel).toBe(BTN_AGREGAR_TARJETA);
    fireEvent.press(screen.getByTestId('msi-agregar-tarjeta'));
    expect(alAgregar).toHaveBeenCalledTimes(1);

    // Se agrega la tarjeta (como al volver de `/tarjetas/nueva`): la compra ya la muestra y la elige.
    fireEvent.changeText(screen.getByTestId('tarjeta-nombre'), 'Nu');
    fireEvent.changeText(screen.getByTestId('tarjeta-corte'), '28');
    fireEvent.changeText(screen.getByTestId('tarjeta-limite-pago'), '18');
    fireEvent.changeText(screen.getByTestId('tarjeta-limite-credito'), '30,000');
    fireEvent.press(screen.getByTestId('tarjeta-completa-si'));
    fireEvent.changeText(screen.getByTestId('tarjeta-saldo'), '0');
    fireEvent.press(screen.getByTestId('tarjeta-guardar'));
    const [nu] = listarTarjetas(p.ctx);
    if (!nu) throw new Error('no se agregó la tarjeta');
    expect(screen.queryByTestId('msi-sin-tarjetas')).toBeNull();
    expect(screen.getByTestId(`msi-tarjeta-${nu.id}`).props.accessibilityState).toMatchObject({
      selected: true,
    });
    fireEvent.press(screen.getByTestId('boton-guardar-msi'));
    expect(alGuardar).toHaveBeenCalledWith(expect.objectContaining({ resultado: 'registrado_msi' }));
    expect(listarPlanesMsi(p.ctx, nu.id)).toHaveLength(1);
    p.cerrar();
  });
});

describe('Errores a la vista en tarjeta nueva (auditoría B-3 · 2)', () => {
  it('marca el campo que falta y deja el qué hacer junto a "Guardar tarjeta"', () => {
    const p = abrirPruebaPantalla();
    renderConSesion(p.ctx, <FormularioTarjetaNueva alGuardar={jest.fn()} alCancelar={jest.fn()} />);
    fireEvent.changeText(screen.getByTestId('tarjeta-nombre'), 'Nu');
    fireEvent.press(screen.getByTestId('tarjeta-guardar'));
    expect(screen.getByTestId('error-formulario')).toHaveTextContent('Escribe el día de corte, del 1 al 31.');
    expect(screen.getByTestId('tarjeta-corte')).toHaveProp('accessibilityHint', MARCA_CAMPO_CON_ERROR);
    // El mensaje queda justo antes del botón.
    const formulario = screen.getByTestId('formulario-tarjeta-nueva');
    const hijos = formulario.findAll((n) => typeof n.props.testID === 'string', { deep: true });
    const ids = hijos.map((n) => n.props.testID as string);
    expect(ids.indexOf('error-formulario')).toBeLessThan(ids.indexOf('tarjeta-guardar'));
    // Al corregir el campo se quitan la marca y el mensaje.
    fireEvent.changeText(screen.getByTestId('tarjeta-corte'), '28');
    expect(screen.queryByTestId('error-formulario')).toBeNull();
    expect(screen.getByTestId('tarjeta-corte').props.accessibilityHint).toBeUndefined();
    p.cerrar();
  });

  it('iPhone: VoiceOver anuncia el error (la región viva solo existe en Android)', () => {
    const plataforma = jest.replaceProperty(Platform, 'OS', 'ios');
    const anunciar = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    try {
      const p = abrirPruebaPantalla();
      renderConSesion(p.ctx, <FormularioTarjetaNueva alGuardar={jest.fn()} alCancelar={jest.fn()} />);
      fireEvent.press(screen.getByTestId('tarjeta-guardar'));
      expect(anunciar).toHaveBeenCalledWith('Escribe el nombre de la tarjeta.');
      expect(screen.getByTestId('tarjeta-nombre')).toHaveProp('accessibilityHint', MARCA_CAMPO_CON_ERROR);
      p.cerrar();
    } finally {
      anunciar.mockRestore();
      plataforma.restore();
    }
  });
});

describe('Detalle de la tarjeta: textos y confirmaciones (auditoría B-3 · 3 y 4)', () => {
  it('"Registrar pago" abre el formulario; "Corregir saldo" abre y "Guardar saldo" confirma, cada uno con Cancelar', () => {
    const p = e510();
    renderConSesion(p.ctx, <PantallaTarjeta tarjetaId={p.oro} alVolver={jest.fn()} />);
    expect(screen.getByTestId('tarjeta-pagar').props.accessibilityLabel).toBe(BTN_PAGAR);
    expect(BTN_PAGAR).toBe('Registrar pago');
    fireEvent.press(screen.getByTestId('tarjeta-pagar'));
    fireEvent.press(screen.getByTestId('pagar-cancelar'));
    expect(screen.queryByTestId('pagar')).toBeNull();

    expect(screen.getByTestId('tarjeta-corregir').props.accessibilityLabel).toBe(BTN_CORREGIR_SALDO);
    fireEvent.press(screen.getByTestId('tarjeta-corregir'));
    expect(screen.getByTestId('corregir-guardar').props.accessibilityLabel).toBe(BTN_GUARDAR_SALDO);
    fireEvent.press(screen.getByTestId('corregir-cancelar'));
    expect(screen.queryByTestId('corregir-saldo')).toBeNull();
    p.cerrar();
  });

  it('"Quitar" un pago planeado pregunta antes; "Cancelar" lo deja como estaba', () => {
    const p = e510();
    renderConSesion(p.ctx, <PantallaTarjeta tarjetaId={p.oro} alVolver={jest.fn()} />);
    // Los pagos planeados son del modo "Voy pagando por partes".
    fireEvent.press(screen.getByTestId('tarjeta-editar'));
    fireEvent.press(screen.getByTestId('editar-modo-plan'));
    fireEvent.press(screen.getByTestId('editar-guardar'));
    fireEvent.press(screen.getByTestId('pago-planeado-agregar'));
    fireEvent.changeText(screen.getByTestId('pago-planeado-monto'), '500');
    fireEvent.press(screen.getByTestId('pago-planeado-guardar'));
    const [pago] = listarPagosPlaneados(p.ctx, p.oro);
    if (!pago) throw new Error('sin pago planeado');
    const id = `pago-planeado-${pago.programadoId}`;
    fireEvent.press(screen.getByTestId(`${id}-quitar`));
    expect(
      within(screen.getByTestId(`${id}-confirmacion`)).getByText(TEXTO_CONFIRMAR_QUITAR_PAGO_PLANEADO),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId(`${id}-cancelar-quitar`));
    expect(listarPagosPlaneados(p.ctx, p.oro)).toHaveLength(1);
    expect(screen.queryByTestId(`${id}-confirmacion`)).toBeNull();
    fireEvent.press(screen.getByTestId(`${id}-quitar`));
    fireEvent.press(screen.getByTestId(`${id}-confirmar-quitar`));
    expect(listarPagosPlaneados(p.ctx, p.oro)).toEqual([]);
    p.cerrar();
  });
});
