import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';
import {
  aceptarConsentimiento,
  agregarCuenta,
  agregarEfectivo,
  agregarPagoFijo,
  crearPersona,
  crearTanda,
  listarCuentas,
  listarPagosFijos,
  listarPersonas,
  registrarPrestamo,
} from '../../servicios';
import { leerMontoDictado } from '../../servicios/voz-campos';
import { ProveedorDictado } from '../../voz';
import { auditar } from '../__pruebas__/accesibilidad';
import { RESPUESTAS_PAGO_INICIALES } from '../onboarding/pagos-fijos';
import { FormularioPagoFijo } from '../pagos-fijos/FormularioPagoFijo';
import { PantallaCuentas } from '../principal';
import { MenuAgregar } from './MenuAgregar';
import { crearMotorFalso, renderConSesion } from '../principal/__pruebas__/arnes';
import { abrirPruebaPantalla } from '../principal/__pruebas__/base';
import { FormularioCuenta } from './FormularioCuenta';
import { PantallaDetalleCuenta } from './PantallaDetalleCuenta';
import { PantallaDetallePagoFijo } from './PantallaDetallePagoFijo';
import { PantallaNuevaCuenta } from './PantallaNuevaCuenta';
import { PantallaNuevoPagoFijo } from './PantallaNuevoPagoFijo';
import { PantallaPagosFijos } from './PantallaPagosFijos';
import { PantallaPersonas } from './PantallaPersonas';
import {
  BTN_AGREGAR_CUENTA,
  BTN_AGREGAR_PAGO_FIJO,
  COMPROMISO_DE_OTRA_PANTALLA,
  ERROR_CUENTA_INCOMPLETA,
  ERROR_PAGO_FIJO_INCOMPLETO,
  ERROR_ULTIMOS4,
  MENSAJE_SALDO_IGUAL,
  TEXTO_CUENTA_NO_ENCONTRADA,
  TEXTO_EFECTIVO_SE_CUENTA,
  TEXTO_PAGO_NO_ENCONTRADO,
  TEXTO_QUITAR_CONFIRMA,
} from './textos';

function preparar() {
  const p = abrirPruebaPantalla('2026-10-11');
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  const efectivo = agregarEfectivo(p.ctx, 50_000);
  const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 435_000, ultimos4: '5521' });
  return { ...p, efectivo, bbva };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Agregar cuenta después del onboarding', () => {
  it('guarda una billetera con su saldo y regresa con «Listo»', () => {
    const p = preparar();
    const alGuardar = jest.fn();
    renderConSesion(p.ctx, <PantallaNuevaCuenta alVolver={jest.fn()} alGuardar={alGuardar} />);
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    fireEvent.press(screen.getByTestId('cuenta-nueva-tipo-billetera'));
    fireEvent.changeText(screen.getByTestId('cuenta-nueva-nombre'), '  Mercado Pago ');
    fireEvent.changeText(screen.getByTestId('cuenta-nueva-saldo'), '1,250.50');
    fireEvent.press(screen.getByTestId('cuenta-nueva-guardar'));
    expect(alGuardar).toHaveBeenCalledWith('Listo: agregué Mercado Pago.');
    const nueva = listarCuentas(p.ctx).tienes.find((c) => c.nombre === 'Mercado Pago');
    expect(nueva).toMatchObject({ subtipo: 'billetera', saldo: 125_050 });
    p.cerrar();
  });

  it('sin nombre o saldo, o con últimos 4 mal escritos, dice qué falta y no guarda', () => {
    const p = preparar();
    const alGuardar = jest.fn();
    renderConSesion(p.ctx, <PantallaNuevaCuenta alVolver={jest.fn()} alGuardar={alGuardar} />);
    fireEvent.press(screen.getByTestId('cuenta-nueva-guardar'));
    expect(screen.getByTestId('cuenta-nueva-error')).toHaveTextContent(ERROR_CUENTA_INCOMPLETA);
    fireEvent.changeText(screen.getByTestId('cuenta-nueva-nombre'), 'Ahorro Nu');
    fireEvent.changeText(screen.getByTestId('cuenta-nueva-saldo'), '0');
    fireEvent.changeText(screen.getByTestId('cuenta-nueva-ultimos4'), '12a');
    fireEvent.press(screen.getByTestId('cuenta-nueva-guardar'));
    expect(screen.getByTestId('cuenta-nueva-error')).toHaveTextContent(ERROR_ULTIMOS4);
    expect(alGuardar).not.toHaveBeenCalled();
    // $0 es un saldo válido.
    fireEvent.changeText(screen.getByTestId('cuenta-nueva-ultimos4'), '');
    fireEvent.press(screen.getByTestId('cuenta-nueva-tipo-ahorro'));
    fireEvent.press(screen.getByTestId('cuenta-nueva-guardar'));
    expect(alGuardar).toHaveBeenCalledWith('Listo: agregué Ahorro Nu.');
    expect(listarCuentas(p.ctx).tienes.find((c) => c.nombre === 'Ahorro Nu')).toMatchObject({
      subtipo: 'ahorro',
      saldo: 0,
    });
    p.cerrar();
  });

  it('en iPhone el error se anuncia a VoiceOver', () => {
    const p = preparar();
    const anuncio = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    renderConSesion(p.ctx, <PantallaNuevaCuenta alVolver={jest.fn()} alGuardar={jest.fn()} />);
    jest.replaceProperty(Platform, 'OS', 'ios');
    fireEvent.press(screen.getByTestId('cuenta-nueva-guardar'));
    expect(anuncio).toHaveBeenCalledWith(ERROR_CUENTA_INCOMPLETA);
    p.cerrar();
  });
});

describe('Detalle de una cuenta de Tienes', () => {
  it('Corregir saldo registra el ajuste y muestra el saldo nuevo', () => {
    const p = preparar();
    renderConSesion(
      p.ctx,
      <PantallaDetalleCuenta cuentaId={p.bbva} alVolver={jest.fn()} alVerMovimientos={jest.fn()} />,
    );
    expect(screen.getByTestId('cuenta-detalle-titulo')).toHaveTextContent('BBVA');
    expect(screen.getByTestId('cuenta-detalle-subtitulo')).toHaveTextContent('Débito · Termina en 5521');
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    fireEvent.press(screen.getByTestId('cuenta-detalle-corregir'));
    fireEvent.changeText(screen.getByTestId('cuenta-detalle-saldo-real'), '4,200');
    fireEvent.press(screen.getByTestId('cuenta-detalle-guardar-saldo'));
    expect(p.ctx.libro.saldo(p.bbva)).toBe(420_000);
    expect(screen.getByTestId('cuenta-detalle-mensaje')).toHaveTextContent('Listo: en BBVA tienes $4,200.');
    expect(screen.getByTestId('cuenta-detalle-saldo')).toHaveTextContent('$4,200');
    // Mismo saldo otra vez: no registra nada.
    fireEvent.press(screen.getByTestId('cuenta-detalle-corregir'));
    fireEvent.changeText(screen.getByTestId('cuenta-detalle-saldo-real'), '4200');
    fireEvent.press(screen.getByTestId('cuenta-detalle-guardar-saldo'));
    expect(screen.getByTestId('cuenta-detalle-mensaje')).toHaveTextContent(MENSAJE_SALDO_IGUAL);
    p.cerrar();
  });

  it('Ver movimientos lleva el id de la cuenta; el efectivo se cuenta en vez de corregirse', () => {
    const p = preparar();
    const alVerMovimientos = jest.fn();
    const alContarEfectivo = jest.fn();
    renderConSesion(
      p.ctx,
      <PantallaDetalleCuenta
        cuentaId={p.efectivo}
        alVolver={jest.fn()}
        alVerMovimientos={alVerMovimientos}
        alContarEfectivo={alContarEfectivo}
      />,
    );
    expect(screen.queryByTestId('cuenta-detalle-corregir')).toBeNull();
    expect(screen.getByTestId('cuenta-detalle-efectivo')).toHaveTextContent(TEXTO_EFECTIVO_SE_CUENTA);
    fireEvent.press(screen.getByTestId('cuenta-detalle-contar'));
    expect(alContarEfectivo).toHaveBeenCalledWith(p.efectivo);
    fireEvent.press(screen.getByTestId('cuenta-detalle-movimientos'));
    expect(alVerMovimientos).toHaveBeenCalledWith(p.efectivo);
    p.cerrar();
  });

  it('una cuenta que no existe no deja la pantalla en blanco', () => {
    const p = preparar();
    const alVolver = jest.fn();
    renderConSesion(
      p.ctx,
      <PantallaDetalleCuenta cuentaId="no-existe" alVolver={alVolver} alVerMovimientos={jest.fn()} />,
    );
    expect(screen.getByTestId('cuenta-detalle-no-encontrada')).toHaveTextContent(TEXTO_CUENTA_NO_ENCONTRADA);
    fireEvent.press(screen.getByTestId('cuenta-detalle-volver'));
    expect(alVolver).toHaveBeenCalled();
    p.cerrar();
  });
});

describe('Agregar pago fijo después del onboarding', () => {
  it('el formulario de O5: renta el día 1, sale de BBVA', () => {
    const p = preparar();
    const alGuardar = jest.fn();
    renderConSesion(p.ctx, <PantallaNuevoPagoFijo alVolver={jest.fn()} alGuardar={alGuardar} />);
    fireEvent.press(screen.getByTestId('pago-nuevo-renta'));
    expect(screen.getByTestId('pago-nuevo-nombre').props.value).toBe('Renta');
    fireEvent.press(screen.getByTestId('pago-nuevo-guardar'));
    expect(screen.getByTestId('pago-nuevo-error')).toHaveTextContent(ERROR_PAGO_FIJO_INCOMPLETO);
    fireEvent.changeText(screen.getByTestId('pago-nuevo-dia'), '1');
    fireEvent.changeText(screen.getByTestId('pago-nuevo-monto'), '8,000');
    fireEvent.press(screen.getByTestId('pago-nuevo-mas-opciones'));
    fireEvent.press(screen.getByTestId(`pago-nuevo-cuenta-${p.bbva}`));
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    fireEvent.press(screen.getByTestId('pago-nuevo-guardar'));
    expect(alGuardar).toHaveBeenCalledWith('Listo: agregué renta. Ya lo aparto.');
    expect(listarPagosFijos(p.ctx)).toEqual([
      expect.objectContaining({
        concepto: 'renta',
        monto: 800_000,
        regla: { tipo: 'mensual', dia: 1 },
        cuenta: 'BBVA',
        proxima: '2026-11-01',
      }),
    ]);
    p.cerrar();
  });

  it('«Otro» anual con nombre propio y pagos que faltan', () => {
    const p = preparar();
    const alGuardar = jest.fn();
    renderConSesion(p.ctx, <PantallaNuevoPagoFijo alVolver={jest.fn()} alGuardar={alGuardar} />);
    fireEvent.press(screen.getByTestId('pago-nuevo-otro'));
    fireEvent.changeText(screen.getByTestId('pago-nuevo-nombre'), 'Seguro del coche');
    fireEvent.press(screen.getByTestId('pago-nuevo-frecuencia-anual'));
    fireEvent.press(screen.getByTestId('pago-nuevo-mes-3'));
    fireEvent.changeText(screen.getByTestId('pago-nuevo-dia'), '15');
    fireEvent.changeText(screen.getByTestId('pago-nuevo-monto'), '6,500');
    fireEvent.press(screen.getByTestId('pago-nuevo-variable'));
    fireEvent.press(screen.getByTestId('pago-nuevo-mas-opciones'));
    fireEvent.changeText(screen.getByTestId('pago-nuevo-restantes'), '2');
    fireEvent.press(screen.getByTestId('pago-nuevo-guardar'));
    expect(alGuardar).toHaveBeenCalledWith('Listo: agregué Seguro del coche. Ya lo aparto.');
    expect(listarPagosFijos(p.ctx)).toEqual([
      expect.objectContaining({
        concepto: 'Seguro del coche',
        monto: 650_000,
        regla: { tipo: 'anual', mes: 3, dia: 15 },
        variable: true,
        hasta: '2028-03-15',
      }),
    ]);
    p.cerrar();
  });

  it('«O dímelo» en Cuentas: «pago 4500 de renta cada mes el 5» llena el formulario y no guarda hasta tocar', async () => {
    const p = preparar();
    const f = crearMotorFalso();
    const alGuardar = jest.fn();
    renderConSesion(
      p.ctx,
      <ProveedorDictado motor={f.motor} leerMonto={leerMontoDictado}>
        <PantallaNuevoPagoFijo alVolver={jest.fn()} alGuardar={alGuardar} />
      </ProveedorDictado>,
    );
    await act(async () => {
      fireEvent(screen.getByTestId('pago-nuevo-decir-dictar'), 'pressIn');
    });
    fireEvent(screen.getByTestId('pago-nuevo-decir-dictar'), 'pressOut');
    f.emitir({ tipo: 'resultado', texto: 'pago 4500 de renta cada mes el 5', final: true });
    expect(screen.getByTestId('pago-nuevo-renta')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByTestId('pago-nuevo-nombre').props.value).toBe('Renta');
    expect(screen.getByTestId('pago-nuevo-dia').props.value).toBe('5');
    expect(screen.getByTestId('pago-nuevo-monto').props.value).toBe('4,500');
    expect(listarPagosFijos(p.ctx)).toEqual([]);
    fireEvent.press(screen.getByTestId('pago-nuevo-guardar'));
    expect(alGuardar).toHaveBeenCalledWith('Listo: agregué renta. Ya lo aparto.');
    expect(listarPagosFijos(p.ctx)).toEqual([
      expect.objectContaining({ concepto: 'renta', monto: 450_000, regla: { tipo: 'mensual', dia: 5 } }),
    ]);
    p.cerrar();
  });
});

/**
 * Un formulario por entidad (`docs/PLAN-MEJORA-2026-10.md` §5): `FormularioCuenta` y `FormularioPagoFijo` son los de
 * O4 y O5 y los que envuelven las pantallas de Cuentas. Aquí se prueban como los usa el onboarding (tarjeta con su
 * botón) y su API nueva (prellenado, sin «O dímelo»).
 */
describe('Formularios compartidos con el onboarding', () => {
  // Dirección B: «Agregar» del dock de Cuentas abre el menú; ya no hay botones sueltos en cada sección.
  it('«Agregar cuenta» y «Agregar pago fijo» del menú «Agregar» solo aparecen con su destino y lo abren', () => {
    const p = preparar();
    const alAgregarCuenta = jest.fn();
    const alAgregarPagoFijo = jest.fn();
    const alCerrar = jest.fn();
    renderConSesion(
      p.ctx,
      <MenuAgregar
        abajo={0}
        alCerrar={alCerrar}
        alAgregarCuenta={alAgregarCuenta}
        alAgregarPagoFijo={alAgregarPagoFijo}
      />,
    );
    expect(screen.getByTestId('boton-agregar-cuenta').props.accessibilityLabel).toBe(BTN_AGREGAR_CUENTA);
    expect(screen.getByTestId('boton-agregar-pago-fijo').props.accessibilityLabel).toBe(
      BTN_AGREGAR_PAGO_FIJO,
    );
    expect(screen.queryByTestId('boton-agregar-tarjeta')).toBeNull();
    fireEvent.press(screen.getByTestId('boton-agregar-cuenta'));
    fireEvent.press(screen.getByTestId('boton-agregar-pago-fijo'));
    expect(alAgregarCuenta).toHaveBeenCalled();
    expect(alAgregarPagoFijo).toHaveBeenCalled();
    expect(alCerrar).toHaveBeenCalledTimes(2);
    screen.unmount();
    renderConSesion(p.ctx, <PantallaCuentas alAgregarCuenta={jest.fn()} alAgregarPagoFijo={jest.fn()} />);
    expect(screen.queryByTestId('boton-agregar-cuenta')).toBeNull();
    expect(screen.queryByTestId('boton-agregar-pago-fijo')).toBeNull();
    p.cerrar();
  });

  it('cuenta en tarjeta (O4): dice qué falta, guarda con últimos 4 y queda en Tienes', () => {
    const p = preparar();
    const alGuardar = jest.fn();
    const alCancelar = jest.fn();
    renderConSesion(p.ctx, <FormularioCuenta alGuardar={alGuardar} alCancelar={alCancelar} />);
    fireEvent.press(screen.getByTestId('onb-cuenta-agregar'));
    expect(screen.getByTestId('error-formulario')).toHaveTextContent(ERROR_CUENTA_INCOMPLETA);
    expect(alGuardar).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('onb-cuenta-tipo-ahorro'));
    fireEvent.changeText(screen.getByTestId('onb-cuenta-nombre'), 'Nu');
    fireEvent.changeText(screen.getByTestId('onb-cuenta-saldo'), '2,500');
    fireEvent.changeText(screen.getByTestId('onb-cuenta-ultimos4'), '0042');
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    fireEvent.press(screen.getByTestId('onb-cuenta-agregar'));
    expect(alGuardar).toHaveBeenCalledWith(expect.any(String), 'Nu');
    expect(listarCuentas(p.ctx).tienes.find((c) => c.nombre === 'Nu')).toMatchObject({
      subtipo: 'ahorro',
      saldo: 250_000,
    });
    fireEvent.press(screen.getByTestId('onb-cuenta-cancelar'));
    expect(alCancelar).toHaveBeenCalled();
    p.cerrar();
  });

  it('cuenta prellenada (lo dicho): sale llena y sin «Cancelar» si no se pide', () => {
    const p = preparar();
    const alGuardar = jest.fn();
    renderConSesion(
      p.ctx,
      <FormularioCuenta
        alGuardar={alGuardar}
        prellenado={{ tipo: 'billetera', nombre: 'Mercado Pago', saldo: 0 }}
      />,
    );
    expect(screen.getByTestId('onb-cuenta-tipo-billetera')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByTestId('onb-cuenta-nombre').props.value).toBe('Mercado Pago');
    expect(screen.getByTestId('onb-cuenta-saldo').props.value).toBe('0');
    expect(screen.queryByTestId('onb-cuenta-cancelar')).toBeNull();
    fireEvent.press(screen.getByTestId('onb-cuenta-agregar'));
    expect(alGuardar).toHaveBeenCalledWith(expect.any(String), 'Mercado Pago');
    p.cerrar();
  });

  it('pago fijo en tarjeta (O5): avisa lo agregado, vuelve a empezar y aparece en Compromisos', () => {
    const p = preparar();
    const alAgregado = jest.fn();
    renderConSesion(p.ctx, <FormularioPagoFijo alAgregado={alAgregado} />);
    fireEvent.press(screen.getByTestId('onb-pago-renta'));
    fireEvent.changeText(screen.getByTestId('onb-pago-dia'), '5');
    fireEvent.changeText(screen.getByTestId('onb-pago-monto'), '4,500');
    fireEvent.press(screen.getByTestId('onb-pago-agregar'));
    expect(alAgregado).toHaveBeenCalledWith(
      expect.objectContaining({ concepto: 'Renta', conceptoGuardado: 'renta', monto: 450_000, cuenta: null }),
    );
    expect(screen.queryByTestId('onb-pago-formulario')).toBeNull();
    screen.unmount();
    renderConSesion(p.ctx, <PantallaCuentas />);
    expect(screen.getByTestId('seccion-compromisos-lista')).toHaveTextContent(/renta/i);
    p.cerrar();
  });

  it('pago fijo prellenado: chip, nombre, día, monto y cuenta de salida a la vista; sin «O dímelo» si no se pide', () => {
    const p = preparar();
    const alAgregado = jest.fn();
    const f = crearMotorFalso();
    renderConSesion(
      p.ctx,
      <ProveedorDictado motor={f.motor} leerMonto={leerMontoDictado}>
        <FormularioPagoFijo
          alAgregado={alAgregado}
          conDecirlo={false}
          prellenado={{
            clave: 'luz',
            nombre: 'Luz',
            monto: 40_000,
            respuestas: { ...RESPUESTAS_PAGO_INICIALES, frecuencia: 'mensual', diaMes: '20' },
            cuentaId: p.bbva,
          }}
        />
      </ProveedorDictado>,
    );
    expect(screen.queryByTestId('onb-pago-decir')).toBeNull();
    expect(screen.getByTestId('onb-pago-nombre').props.value).toBe('Luz');
    expect(screen.getByTestId('onb-pago-dia').props.value).toBe('20');
    expect(screen.getByTestId('onb-pago-monto').props.value).toBe('400');
    expect(screen.getByTestId('onb-pago-variable')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ checked: true }),
    );
    expect(screen.getByTestId(`onb-pago-cuenta-${p.bbva}`)).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    fireEvent.press(screen.getByTestId('onb-pago-agregar'));
    expect(alAgregado).toHaveBeenCalledWith(
      expect.objectContaining({ concepto: 'Luz', conceptoGuardado: 'luz', cuenta: 'BBVA' }),
    );
    p.cerrar();
  });
});

describe('Detalle de un pago fijo', () => {
  it('Cambiar monto y Quitar (con confirmación)', () => {
    const p = preparar();
    const renta = agregarPagoFijo(p.ctx, {
      concepto: 'renta',
      monto: 800_000,
      regla: { tipo: 'mensual', dia: 1 },
    });
    const alQuitado = jest.fn();
    renderConSesion(
      p.ctx,
      <PantallaDetallePagoFijo programadoId={renta} alVolver={jest.fn()} alQuitado={alQuitado} />,
    );
    expect(screen.getByTestId('pago-detalle-titulo')).toHaveTextContent('Renta');
    expect(screen.getByText('día 1 de cada mes')).toBeTruthy();
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    fireEvent.press(screen.getByTestId('pago-detalle-cambiar-monto'));
    fireEvent.changeText(screen.getByTestId('pago-detalle-monto-nuevo'), '8,500');
    fireEvent.press(screen.getByTestId('pago-detalle-guardar-monto'));
    expect(screen.getByTestId('pago-detalle-mensaje')).toHaveTextContent('Listo: renta ahora es de $8,500.');
    expect(listarPagosFijos(p.ctx)[0]?.monto).toBe(850_000);

    fireEvent.press(screen.getByTestId('pago-detalle-quitar'));
    expect(screen.getByText(TEXTO_QUITAR_CONFIRMA)).toBeTruthy();
    fireEvent.press(screen.getByTestId('pago-detalle-quitar-cancelar'));
    expect(listarPagosFijos(p.ctx)).toHaveLength(1);
    fireEvent.press(screen.getByTestId('pago-detalle-quitar'));
    fireEvent.press(screen.getByTestId('pago-detalle-quitar-confirmar'));
    expect(alQuitado).toHaveBeenCalledWith('Listo: quité renta.');
    expect(listarPagosFijos(p.ctx)).toEqual([]);
    p.cerrar();
  });

  it('la aportación de una tanda no se quita aquí: manda a la tanda', () => {
    const p = preparar();
    const { tandaId, programadoId } = crearTanda(p.ctx, {
      aportacion: 50_000,
      participantes: 4,
      turno: 2,
      regla: { tipo: 'quincenal_15_ultimo' },
      inicio: '2026-10-15',
      cuentaId: null,
    });
    const alAbrirTanda = jest.fn();
    renderConSesion(
      p.ctx,
      <PantallaDetallePagoFijo
        programadoId={programadoId}
        alVolver={jest.fn()}
        alQuitado={jest.fn()}
        alAbrirTanda={alAbrirTanda}
      />,
    );
    expect(screen.queryByTestId('pago-detalle-quitar')).toBeNull();
    expect(screen.queryByTestId('pago-detalle-cambiar-monto')).toBeNull();
    expect(screen.getByText(COMPROMISO_DE_OTRA_PANTALLA.tanda.texto)).toBeTruthy();
    fireEvent.press(screen.getByTestId('pago-detalle-abrir-otra'));
    expect(alAbrirTanda).toHaveBeenCalledWith(tandaId);
    p.cerrar();
  });

  it('un pago que ya no existe lo dice', () => {
    const p = preparar();
    renderConSesion(
      p.ctx,
      <PantallaDetallePagoFijo programadoId="no-existe" alVolver={jest.fn()} alQuitado={jest.fn()} />,
    );
    expect(screen.getByTestId('pago-detalle-no-encontrado')).toHaveTextContent(TEXTO_PAGO_NO_ENCONTRADO);
    p.cerrar();
  });
});

describe('Lista de pagos fijos y de personas', () => {
  it('todos los pagos fijos, también los anuales, cada uno tocable', () => {
    const p = preparar();
    const predial = agregarPagoFijo(p.ctx, {
      concepto: 'predial',
      monto: 300_000,
      regla: { tipo: 'anual', mes: 2, dia: 15 },
    });
    const alAbrir = jest.fn();
    const alAgregar = jest.fn();
    renderConSesion(
      p.ctx,
      <PantallaPagosFijos alVolver={jest.fn()} alAgregar={alAgregar} alAbrir={alAbrir} />,
    );
    expect(screen.getByText('Predial')).toBeTruthy();
    expect(screen.getByText('cada 15 de febrero')).toBeTruthy();
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    fireEvent.press(screen.getByTestId(`pago-fijo-${predial}-abrir`));
    expect(alAbrir).toHaveBeenCalledWith(predial);
    fireEvent.press(screen.getByTestId('pagos-fijos-agregar'));
    expect(alAgregar).toHaveBeenCalled();
    p.cerrar();
  });

  it('personas: te debe, le debes y a mano; cada una abre su ficha', async () => {
    const p = preparar();
    const caro = crearPersona(p.ctx, { nombre: 'Caro' });
    const jefa = crearPersona(p.ctx, { nombre: 'Mi jefa' });
    const beto = crearPersona(p.ctx, { nombre: 'Beto' });
    registrarPrestamo(p.ctx, { tipo: 'prestamo_otorgado', personaId: caro, cuentaId: p.bbva, monto: 40_000 });
    registrarPrestamo(p.ctx, {
      tipo: 'prestamo_recibido',
      personaId: jefa,
      cuentaId: p.bbva,
      monto: 100_000,
    });
    expect(listarPersonas(p.ctx)).toHaveLength(3);
    const alAbrirPersona = jest.fn();
    renderConSesion(p.ctx, <PantallaPersonas alVolver={jest.fn()} alAbrirPersona={alAbrirPersona} />);
    expect(screen.getByTestId(`persona-${caro}-abrir`).props.accessibilityLabel).toBe(
      'Caro te debe cuatrocientos pesos',
    );
    expect(screen.getByTestId(`persona-${jefa}-abrir`).props.accessibilityLabel).toBe(
      'Le debes a Mi jefa mil pesos',
    );
    expect(screen.getByTestId(`persona-${beto}-abrir`).props.accessibilityLabel).toBe(
      'Con Beto están a mano',
    );
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    await act(async () => {
      fireEvent.press(screen.getByTestId(`persona-${beto}-abrir`));
    });
    expect(alAbrirPersona).toHaveBeenCalledWith(beto);
    p.cerrar();
  });
});
