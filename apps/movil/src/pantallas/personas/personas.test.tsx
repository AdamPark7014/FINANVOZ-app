import { act, fireEvent, screen, within } from '@testing-library/react-native';
import {
  crearPersona,
  guardarDatosCobro,
  leerDatosCobro,
  listarCuentas,
  listarMovimientos,
  registrarCuentaDividida,
  registrarPrestamo,
} from '../../servicios';
import { nubeFalsa } from '../../servicios/__pruebas__/nube';
import { SeccionDatosCobro } from '../ajustes/SeccionDatosCobro';
import { SECCION_DATOS_COBRO } from '../ajustes/datos-cobro-textos';
import { notificacionesEnMemoria, ProveedorNotificaciones } from '../avisos/notificaciones';
import { conEscenario, golden } from '../principal/__pruebas__/base';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from '../principal/__pruebas__/arnes';
import { PantallaCuentas } from '../principal/PantallaCuentas';
import { PantallaHoy } from '../principal/PantallaHoy';
import { PantallaRegistrar } from '../principal/PantallaRegistrar';
import { FormularioCuentaDividida } from './FormularioCuentaDividida';
import { PantallaPersona } from './PantallaPersona';
import {
  ERROR_DIVISION_ORIGEN,
  ETIQUETA_CATEGORIA_PARTE,
  ETIQUETA_ORIGEN_DIVISION,
  MENSAJE_PERMISO_AVISOS,
  mensajeRecordatorioCobro,
  mensajeRegistroCobro,
  PISTA_COBRAR,
  PISTA_YA_ME_PAGO,
  PISTA_GUARDAR_DATOS_COBRO,
  PISTA_GUARDAR_PAGO,
  PISTA_GUARDAR_Y_COBRAR,
  PISTA_QUITAR_RECORDATORIO,
  PISTA_VOLVER,
  TEXTO_CONTACTOS_VACIO,
  etiquetaVacioMovimientosPersona,
  TEXTO_MOVIMIENTOS_PERSONA_VACIO,
  TEXTO_PERSONA_NO_ENCONTRADA,
  TIP_SALDO_TE_DEBEN,
} from './textos';

/** CLABE con dígito de control válido. */
const CLABE = '012345678901234568';

const textoDe = (testID: string) => {
  const hijos = screen.getByTestId(testID).props.children as unknown;
  return Array.isArray(hijos) ? hijos.join('') : String(hijos);
};

describe('textos · cuenta dividida', () => {
  it('etiquetas de chips y validación comparten origen', () => {
    expect(ETIQUETA_ORIGEN_DIVISION).toBe('¿Con qué pagaste?');
    expect(ERROR_DIVISION_ORIGEN).toBe(ETIQUETA_ORIGEN_DIVISION);
    expect(ETIQUETA_CATEGORIA_PARTE).toContain('Categoría');
  });
});

function conAmigos() {
  const p = conEscenario('e4-01');
  const caro = crearPersona(p.ctx, { nombre: 'Caro' });
  const juan = crearPersona(p.ctx, { nombre: 'Juan' });
  const ana = crearPersona(p.ctx, { nombre: 'Ana' });
  return { ...p, caro, juan, ana, nu: p.e.cuentas.nu as string, bbva: p.e.cuentas.bbva as string };
}

function cena(p: ReturnType<typeof conAmigos>) {
  return registrarCuentaDividida(p.ctx, {
    total: 120_000,
    partes: 4,
    personaIds: [p.caro, p.juan, p.ana],
    origenId: p.nu,
    categoria: 'comida_fuera',
    fecha: '2026-10-10',
    descripcion: 'la cena',
  });
}

describe('CA-M8-01 · cuenta dividida por voz', () => {
  it('"Cena de 1,200 entre 4 con la Nu": chips de contactos, caso 8 y Te deben $300 por persona', async () => {
    const p = conAmigos();
    const D01 = golden('D01');
    const f = nubeFalsa({ [D01.texto]: D01.esperado });
    renderConSesion(
      p.ctx,
      <>
        <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />
        <PantallaCuentas alAbrirAjustes={jest.fn()} alAbrirPersona={jest.fn()} />
      </>,
      f.nube,
    );
    fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.changeText(screen.getByTestId('campo-registrar'), D01.texto);
    await act(async () => {
      fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    });

    const tarjeta = screen.getByTestId('confirmacion-division');
    expect(within(tarjeta).getByText('¿Con quién dividiste la cuenta?')).toBeTruthy();
    expect(textoDe('division-partes')).toBe('Entre 4');
    expect(textoDe('division-tu-parte')).toBe('$300');
    expect(textoDe('division-te-deben')).toBe('$900');
    expect(textoDe('division-faltan')).toBe('Elige 3 personas (llevas 0).');
    expect(screen.getByTestId(`division-origen-${p.nu}`).props.accessibilityState).toMatchObject({
      selected: true,
    });
    // Sin las tres personas no se guarda nada.
    fireEvent.press(screen.getByTestId('boton-guardar-division'));
    expect(screen.getAllByText('Elige 3 personas (llevas 0).')).toHaveLength(2);
    expect(listarMovimientos(p.ctx)).toEqual([]);

    // Selección múltiple: TalkBack anuncia casillas, no opciones de radio (pendiente 35, pase de M13).
    expect(screen.getByTestId(`division-persona-${p.caro}`)).toHaveProp('accessibilityRole', 'checkbox');
    for (const id of [p.caro, p.juan, p.ana]) fireEvent.press(screen.getByTestId(`division-persona-${id}`));
    expect(screen.getByTestId(`division-persona-${p.caro}`)).toHaveProp('accessibilityState', {
      checked: true,
    });
    fireEvent.press(screen.getByTestId('boton-guardar-division'));

    expect(
      within(screen.getByTestId('aviso')).getByText('Registré: Cuenta dividida $1,200 · te deben $900'),
    ).toBeTruthy();
    const [mov] = listarMovimientos(p.ctx).flatMap((d) => d.movimientos);
    expect(p.ctx.libro.obtener(mov?.id as string)?.asientos.map((a) => [a.cuentaId, a.monto])).toEqual([
      ['cat:personal:comida_fuera', 30_000],
      [p.caro, 30_000],
      [p.juan, 30_000],
      [p.ana, 30_000],
      [p.nu, -120_000],
    ]);
    for (const id of [p.caro, p.juan, p.ana]) expect(textoDe(`te-debe-${id}-saldo`)).toBe('$300');
  });

  it('formulario: "Cuenta dividida" con contactos y una persona nueva', () => {
    const p = conAmigos();
    renderConSesion(p.ctx, <PantallaRegistrar alCerrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId('tipo-cuenta_dividida'));
    fireEvent.changeText(screen.getByTestId('division-total'), '650');
    fireEvent.changeText(screen.getByTestId('division-descripcion'), 'las pizzas');
    fireEvent.press(screen.getByTestId('division-mas'));
    expect(textoDe('division-partes')).toBe('Entre 3');
    fireEvent.press(screen.getByTestId(`division-persona-${p.caro}`));
    fireEvent.changeText(screen.getByTestId('division-nueva-persona'), 'Pepe');
    fireEvent.press(screen.getByTestId('division-boton-agregar'));
    fireEvent.press(screen.getByTestId('division-categoria-comida_fuera'));
    fireEvent.press(screen.getByTestId(`division-origen-${p.bbva}`));
    fireEvent.press(screen.getByTestId('boton-guardar-division'));

    expect(screen.getByText('Registré: las pizzas $650 · te deben $433.33')).toBeTruthy();
    const teDeben = listarCuentas(p.ctx).teDeben;
    expect(teDeben.map((x) => [x.nombre, x.saldo])).toEqual([
      ['Caro', 21_667],
      ['Pepe', 21_666],
    ]);
  });
});

describe('CA-M8-02 · Cobrar', () => {
  it('sin datos para cobrar los pide primero; luego arma el mensaje y abre la hoja de compartir', async () => {
    const p = conAmigos();
    cena(p);
    const compartir = jest.fn(async () => {});
    renderConSesion(p.ctx, <PantallaPersona personaId={p.caro} alVolver={jest.fn()} compartir={compartir} />);
    expect(textoDe('persona-saldo')).toBe('$300');
    expect(screen.getByTestId('boton-cobrar')).toHaveProp('accessibilityHint', PISTA_COBRAR);
    expect(screen.getByTestId('boton-ya-me-pago')).toHaveProp('accessibilityHint', PISTA_YA_ME_PAGO);

    await act(async () => {
      fireEvent.press(screen.getByTestId('boton-cobrar'));
    });
    expect(compartir).not.toHaveBeenCalled();
    expect(screen.getByTestId('persona-pedir-datos')).toBeTruthy();
    expect(screen.getByTestId('boton-guardar-datos-cobro')).toHaveProp(
      'accessibilityHint',
      PISTA_GUARDAR_Y_COBRAR,
    );

    // Una CLABE con el dígito de control mal no se guarda.
    fireEvent.changeText(screen.getByTestId('campo-celular-cobro'), '22 1234 5678');
    fireEvent.changeText(screen.getByTestId('campo-clabe-cobro'), '0123 4567 8901 2345 67');
    await act(async () => {
      fireEvent.press(screen.getByTestId('boton-guardar-datos-cobro'));
    });
    expect(textoDe('error-datos-cobro')).toBe('Esa CLABE no es válida. Revisa los 18 dígitos.');
    expect(screen.getByTestId('error-datos-cobro')).toHaveProp('accessibilityRole', 'alert');
    expect(compartir).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('campo-clabe-cobro'), '0123 4567 8901 2345 68');
    await act(async () => {
      fireEvent.press(screen.getByTestId('boton-guardar-datos-cobro'));
    });
    expect(compartir).toHaveBeenCalledWith(
      'Hola Caro, te recuerdo los $300 de la cena del sáb 10 oct. Me los puedes mandar a mi celular ' +
        '22 1234 5678 (DiMo) o a mi CLABE 0123 4567 8901 2345 68. Gracias.',
    );
    expect(screen.queryByTestId('persona-pedir-datos')).toBeNull();
    expect(leerDatosCobro(p.ctx)).toEqual({ celular: '2212345678', clabe: CLABE });
    // Cobrar no mueve dinero.
    expect(p.ctx.libro.saldo(p.caro)).toBe(30_000);
  });

  it('con datos guardados abre la hoja de compartir directo', async () => {
    const p = conAmigos();
    cena(p);
    guardarDatosCobro(p.ctx, { celular: '2212345678' });
    const compartir = jest.fn(async () => {});
    renderConSesion(p.ctx, <PantallaPersona personaId={p.juan} alVolver={jest.fn()} compartir={compartir} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('boton-cobrar'));
    });
    expect(compartir).toHaveBeenCalledWith(
      'Hola Juan, te recuerdo los $300 de la cena del sáb 10 oct. Me los puedes mandar a mi celular ' +
        '22 1234 5678 (DiMo). Gracias.',
    );
  });

  it('TalkBack en Guardar del panel Ya me pagó (`02 §19`)', () => {
    const p = conAmigos();
    cena(p);
    renderConSesion(p.ctx, <PantallaPersona personaId={p.caro} alVolver={jest.fn()} />);
    fireEvent.press(screen.getByTestId('boton-ya-me-pago'));
    expect(screen.getByTestId('boton-guardar-pago-persona')).toHaveProp('accessibilityHint', PISTA_GUARDAR_PAGO);
  });

  it('"Ya me pagó" de Caro deja su saldo en 0 y sale de Te deben', () => {
    const p = conAmigos();
    cena(p);
    renderConSesion(
      p.ctx,
      <>
        <PantallaPersona personaId={p.caro} alVolver={jest.fn()} />
        <PantallaCuentas alAbrirAjustes={jest.fn()} alAbrirPersona={jest.fn()} />
      </>,
    );
    fireEvent.press(screen.getByTestId('boton-ya-me-pago'));
    fireEvent.press(screen.getByTestId(`pago-persona-destino-${p.bbva}`));
    fireEvent.press(screen.getByTestId('boton-guardar-pago-persona'));
    expect(within(screen.getByTestId('aviso')).getByText(mensajeRegistroCobro(30_000))).toBeTruthy();
    expect(screen.getByText('Están a mano')).toBeTruthy();
    expect(screen.queryByTestId('boton-cobrar')).toBeNull();
    expect(screen.queryByTestId(`te-debe-${p.caro}`)).toBeNull();
    expect(p.ctx.libro.saldo(p.caro)).toBe(0);
  });

  it('Te deben: "Cobrar" abre el detalle de la persona', () => {
    const p = conAmigos();
    cena(p);
    const alAbrirPersona = jest.fn();
    renderConSesion(p.ctx, <PantallaCuentas alAbrirAjustes={jest.fn()} alAbrirPersona={alAbrirPersona} />);
    fireEvent.press(screen.getByTestId(`te-debe-${p.caro}-accion`));
    expect(alAbrirPersona).toHaveBeenCalledWith(p.caro);
  });

  it('Debes: "Ver" abre el detalle de la persona', () => {
    const p = conAmigos();
    registrarPrestamo(p.ctx, {
      tipo: 'prestamo_recibido',
      personaId: p.caro,
      cuentaId: p.bbva,
      monto: 50_000,
    });
    const alAbrirPersona = jest.fn();
    renderConSesion(p.ctx, <PantallaCuentas alAbrirAjustes={jest.fn()} alAbrirPersona={alAbrirPersona} />);
    fireEvent.press(screen.getByTestId(`cuenta-${p.caro}-accion`));
    expect(alAbrirPersona).toHaveBeenCalledWith(p.caro);
  });

  it('formulario: la misma persona puede ocupar más de una parte (×2 en el chip)', () => {
    const p = conAmigos();
    renderConSesion(p.ctx, <PantallaRegistrar alCerrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId('tipo-cuenta_dividida'));
    fireEvent.changeText(screen.getByTestId('division-total'), '1.01');
    fireEvent.press(screen.getByTestId('division-mas'));
    fireEvent.press(screen.getByTestId('division-mas'));
    expect(textoDe('division-partes')).toBe('Entre 4');
    fireEvent.press(screen.getByTestId(`division-persona-${p.caro}`));
    fireEvent.press(screen.getByTestId(`division-persona-${p.caro}`));
    fireEvent.press(screen.getByTestId(`division-persona-${p.juan}`));
    expect(screen.getByText('✓ Caro ×2')).toBeTruthy();
    fireEvent.press(screen.getByTestId('division-categoria-comida_fuera'));
    fireEvent.press(screen.getByTestId(`division-origen-${p.bbva}`));
    fireEvent.press(screen.getByTestId('boton-guardar-division'));
    expect(p.ctx.libro.saldo(p.caro)).toBe(50);
    expect(p.ctx.libro.saldo(p.juan)).toBe(25);
    expect(p.ctx.libro.saldo('cat:personal:comida_fuera')).toBe(26);
  });
});

describe('recordatorio de cobro', () => {
  it('programa un aviso local sin nombre ni monto y se puede quitar', async () => {
    const p = conAmigos();
    cena(p);
    const n = notificacionesEnMemoria('sin_preguntar');
    renderConSesion(
      p.ctx,
      <ProveedorNotificaciones notificaciones={n}>
        <PantallaPersona personaId={p.caro} alVolver={jest.fn()} />
      </ProveedorNotificaciones>,
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('recordatorio-cobro-2026-10-14'));
    });
    expect(n.vecesPedido()).toBe(1);
    expect(textoDe('persona-recordatorio-fecha')).toBe(mensajeRecordatorioCobro('mié 14 oct'));
    expect(screen.getByTestId('boton-quitar-recordatorio')).toHaveProp(
      'accessibilityHint',
      PISTA_QUITAR_RECORDATORIO,
    );
    expect(n.puerto.lista()).toEqual([
      expect.objectContaining({
        id: `cobro:${p.caro}`,
        fecha: '2026-10-14',
        titulo: 'Recordatorio de cobro',
      }),
    ]);
    expect(JSON.stringify(n.puerto.lista())).not.toMatch(/Caro|\$/);

    await act(async () => {
      fireEvent.press(screen.getByTestId('boton-quitar-recordatorio'));
    });
    expect(n.puerto.lista()).toEqual([]);
    expect(screen.getByTestId('recordatorio-cobro-2026-10-12')).toBeTruthy();
  });

  it('sin permiso de avisos lo dice y no guarda nada', async () => {
    const p = conAmigos();
    cena(p);
    const n = notificacionesEnMemoria('denegado');
    renderConSesion(
      p.ctx,
      <ProveedorNotificaciones notificaciones={n}>
        <PantallaPersona personaId={p.caro} alVolver={jest.fn()} />
      </ProveedorNotificaciones>,
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('recordatorio-cobro-2026-10-12'));
    });
    expect(textoDe('persona-recordatorio-mensaje')).toBe(MENSAJE_PERMISO_AVISOS);
    expect(screen.getByTestId('persona-recordatorio-mensaje')).toHaveProp('accessibilityRole', 'alert');
    expect(n.puerto.lista()).toEqual([]);
  });
});

describe('estados vacíos (es-MX)', () => {
  it('persona inexistente', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaPersona personaId="contraparte:persona:inexistente" alVolver={jest.fn()} />);
    expect(textoDe('persona-no-encontrada')).toBe(TEXTO_PERSONA_NO_ENCONTRADA);
    expect(screen.getByTestId('persona-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER);
  });

  it('sin movimientos lo explica', () => {
    const p = conEscenario('e4-01');
    const pepe = crearPersona(p.ctx, { nombre: 'Pepe' });
    renderConSesion(p.ctx, <PantallaPersona personaId={pepe} alVolver={jest.fn()} />);
    expect(textoDe('persona-movimientos-vacio')).toBe(TEXTO_MOVIMIENTOS_PERSONA_VACIO);
    expect(screen.getByTestId('persona-movimientos-vacio').props.accessibilityLabel).toBe(
      etiquetaVacioMovimientosPersona(),
    );
    expect(screen.getByTestId('persona-movimientos-titulo')).toHaveProp('accessibilityRole', 'header');
  });

  it('con saldo a favor muestra el tip de dinero libre', () => {
    const p = conAmigos();
    cena(p);
    renderConSesion(p.ctx, <PantallaPersona personaId={p.caro} alVolver={jest.fn()} />);
    expect(screen.getByTestId('persona-nombre')).toHaveProp('accessibilityRole', 'header');
    expect(textoDe('persona-tip-te-deben')).toBe(TIP_SALDO_TE_DEBEN);
  });

  it('cuenta dividida sin contactos', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <FormularioCuentaDividida alGuardar={jest.fn()} />);
    expect(textoDe('division-contactos-vacio')).toBe(TEXTO_CONTACTOS_VACIO);
  });
});

describe('Ajustes → Datos para cobrar', () => {
  it('titulo de seccion es encabezado TalkBack', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <SeccionDatosCobro />);
    expect(screen.getByTestId('ajustes-datos-cobro-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByText(SECCION_DATOS_COBRO)).toBeTruthy();
  });

  it('agrega, cambia y borra', () => {
    const p = conAmigos();
    renderConSesion(p.ctx, <SeccionDatosCobro />);
    fireEvent.press(screen.getByTestId('boton-editar-datos-cobro'));
    expect(screen.getByTestId('boton-guardar-datos-cobro')).toHaveProp(
      'accessibilityHint',
      PISTA_GUARDAR_DATOS_COBRO,
    );
    fireEvent.changeText(screen.getByTestId('campo-celular-cobro'), '221234');
    fireEvent.press(screen.getByTestId('boton-guardar-datos-cobro'));
    expect(textoDe('error-datos-cobro')).toBe('El celular debe tener 10 dígitos.');
    fireEvent.changeText(screen.getByTestId('campo-celular-cobro'), '2212345678');
    fireEvent.press(screen.getByTestId('boton-guardar-datos-cobro'));
    expect(textoDe('datos-cobro-resumen')).toBe('Celular: 22 1234 5678');
    fireEvent.press(screen.getByTestId('boton-borrar-datos-cobro'));
    expect(leerDatosCobro(p.ctx)).toBeNull();
  });
});
