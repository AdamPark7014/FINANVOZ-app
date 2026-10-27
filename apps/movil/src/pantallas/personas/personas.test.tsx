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
import {
  etiquetaResumenDatosCobro,
  PISTA_AGREGAR_DATOS_COBRO,
  PISTA_BORRAR_DATOS_COBRO,
  PISTA_CAMBIAR_DATOS_COBRO,
  RESUMEN_VACIO,
  SECCION_DATOS_COBRO,
} from '../ajustes/datos-cobro-textos';
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
  BTN_ABRIR_AJUSTES,
  PISTA_ABRIR_AJUSTES_AVISOS,
  mensajeRecordatorioCobro,
  PISTA_AGREGAR_PERSONA,
  PISTA_COBRAR,
  PISTA_YA_ME_PAGO,
  PISTA_GUARDAR_DATOS_COBRO,
  PISTA_CANCELAR_DATOS_COBRO,
  PISTA_GUARDAR_DIVISION,
  PISTA_GUARDAR_PAGO,
  PISTA_GUARDAR_Y_COBRAR,
  PISTA_MAS_PARTES,
  PISTA_MENOS_PARTES,
  PISTA_QUITAR_RECORDATORIO,
  PISTA_VOLVER,
  TITULO_PEDIR_DATOS_COBRO,
  TITULO_YA_ME_PAGO,
  TEXTO_CONTACTOS_VACIO,
  etiquetaPersonaNoEncontrada,
  etiquetaVacioContactosDivision,
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
        <PantallaCuentas alAbrirPersona={jest.fn()} />
      </>,
      f.nube,
    );
    fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.changeText(screen.getByTestId('campo-registrar'), D01.texto);
    await act(async () => {
      fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    });

    // Ola 7 (flujo conversacional, §6): entre 4 y con la Nu ya se dijeron; solo pregunta con quién, una persona a
    // la vez, con un chip por contacto. Mientras falte alguien no se guarda nada.
    expect(textoDe('pregunta-texto')).toBe('¿Con quién fue? Faltan 3.');
    for (const [i, id] of [p.caro, p.juan, p.ana].entries()) {
      expect(listarMovimientos(p.ctx)).toEqual([]);
      if (i === 2) expect(textoDe('pregunta-texto')).toBe('¿Con quién más fue?');
      // Un contacto ya elegido no vuelve a salir como chip (no se repite persona por toque).
      expect(screen.queryByTestId(`pregunta-chip-${p.caro}`) === null).toBe(i > 0);
      await act(async () => {
        fireEvent.press(screen.getByTestId(`pregunta-chip-${id}`));
      });
    }

    // «Entendí»: tu parte y la de cada persona (E12.1, caso 8) y con qué pagaste.
    const entendi = screen.getByTestId('entendi');
    expect(within(entendi).getByTestId('entendi-fila-partes')).toHaveTextContent(/4, contándote/);
    expect(within(entendi).getByTestId('entendi-fila-tu_parte')).toHaveTextContent(/\$300/);
    for (const k of [1, 2, 3]) {
      expect(within(entendi).getByTestId(`entendi-fila-persona-${k}`)).toHaveTextContent(/te debe \$300/);
    }
    expect(within(entendi).getByTestId('entendi-fila-origen')).toHaveTextContent(/Nu/);
    expect(listarMovimientos(p.ctx)).toEqual([]);
    await act(async () => {
      fireEvent.press(screen.getByTestId('entendi-confirmar'));
    });

    // El nivel 0 (06 §9) trae la descripción («cena»): el turno la usa.
    expect(screen.getByTestId('aviso-texto')).toHaveTextContent('Registré Cena $1,200 entre 4.');
    expect(screen.getByTestId('aviso-detalle')).toHaveTextContent('Te deben $900.');
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
    // TalkBack (antes se revisaba en la tarjeta de confirmación de Hoy; el formulario es el mismo): pistas de ±,
    // partes como región viva y selección múltiple con casillas (pendiente 35, pase de M13).
    expect(screen.getByTestId('division-menos')).toHaveProp('accessibilityHint', PISTA_MENOS_PARTES);
    expect(screen.getByTestId('division-mas')).toHaveProp('accessibilityHint', PISTA_MAS_PARTES);
    expect(screen.getByTestId('division-partes')).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.getByTestId(`division-persona-${p.caro}`)).toHaveProp('accessibilityRole', 'checkbox');
    fireEvent.press(screen.getByTestId(`division-persona-${p.caro}`));
    fireEvent.changeText(screen.getByTestId('division-nueva-persona'), 'Pepe');
    fireEvent.press(screen.getByTestId('division-boton-agregar'));
    fireEvent.press(screen.getByTestId('division-categoria-comida_fuera'));
    fireEvent.press(screen.getByTestId(`division-origen-${p.bbva}`));
    fireEvent.press(screen.getByTestId('boton-guardar-division'));

    expect(screen.getByTestId('aviso')).toHaveTextContent(/las pizzas \$650 · te deben \$433\.33/);
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
    expect(screen.getByTestId('boton-ya-me-pago')).toHaveProp('accessibilityState', { expanded: false });

    await act(async () => {
      fireEvent.press(screen.getByTestId('boton-cobrar'));
    });
    expect(compartir).not.toHaveBeenCalled();
    expect(screen.getByTestId('persona-pedir-datos')).toBeTruthy();
    expect(screen.getByTestId('persona-pedir-datos-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByText(TITULO_PEDIR_DATOS_COBRO)).toBeTruthy();
    expect(screen.getByTestId('boton-guardar-datos-cobro')).toHaveProp(
      'accessibilityHint',
      PISTA_GUARDAR_Y_COBRAR,
    );
    expect(screen.getByTestId('boton-cancelar-datos-cobro')).toHaveProp(
      'accessibilityHint',
      PISTA_CANCELAR_DATOS_COBRO,
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
    expect(screen.getByTestId('boton-ya-me-pago')).toHaveProp('accessibilityState', { expanded: true });
    expect(screen.getByTestId('persona-ya-me-pago-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByText(TITULO_YA_ME_PAGO)).toBeTruthy();
    expect(screen.getByTestId('boton-guardar-pago-persona')).toHaveProp(
      'accessibilityHint',
      PISTA_GUARDAR_PAGO,
    );
    fireEvent.press(screen.getByTestId('boton-guardar-pago-persona'));
    expect(screen.getByTestId('persona-ya-me-pago-faltante')).toHaveProp('accessibilityRole', 'alert');
  });

  it('"Ya me pagó" de Caro deja su saldo en 0 y sale de Te deben', () => {
    const p = conAmigos();
    cena(p);
    renderConSesion(
      p.ctx,
      <>
        <PantallaPersona personaId={p.caro} alVolver={jest.fn()} />
        <PantallaCuentas alAbrirPersona={jest.fn()} />
      </>,
    );
    fireEvent.press(screen.getByTestId('boton-ya-me-pago'));
    fireEvent.press(screen.getByTestId(`pago-persona-destino-${p.bbva}`));
    fireEvent.press(screen.getByTestId('boton-guardar-pago-persona'));
    expect(screen.getByTestId('aviso')).toHaveTextContent(/Registré que te pagó \$300/);
    expect(screen.getByText('Están a mano')).toBeTruthy();
    expect(screen.queryByTestId('boton-cobrar')).toBeNull();
    expect(screen.queryByTestId(`te-debe-${p.caro}`)).toBeNull();
    expect(p.ctx.libro.saldo(p.caro)).toBe(0);
  });

  it('Te deben: "Cobrar" abre el detalle de la persona', () => {
    const p = conAmigos();
    cena(p);
    const alAbrirPersona = jest.fn();
    renderConSesion(p.ctx, <PantallaCuentas alAbrirPersona={alAbrirPersona} />);
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
    renderConSesion(p.ctx, <PantallaCuentas alAbrirPersona={alAbrirPersona} />);
    fireEvent.press(screen.getByTestId(`cuenta-${p.caro}-accion`));
    expect(alAbrirPersona).toHaveBeenCalledWith(p.caro);
  });

  it('formulario: tocar a alguien ya elegido lo desmarca (antes salía «Caro ×2»)', () => {
    const p = conAmigos();
    renderConSesion(p.ctx, <PantallaRegistrar alCerrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId('tipo-cuenta_dividida'));
    fireEvent.changeText(screen.getByTestId('division-total'), '1.01');
    fireEvent.press(screen.getByTestId('division-mas'));
    expect(textoDe('division-partes')).toBe('Entre 3');
    fireEvent.press(screen.getByTestId(`division-persona-${p.caro}`));
    expect(screen.getByTestId(`division-persona-${p.caro}`).props.accessibilityState).toMatchObject({
      checked: true,
    });
    fireEvent.press(screen.getByTestId(`division-persona-${p.caro}`));
    expect(screen.getByTestId(`division-persona-${p.caro}`)).toHaveProp('accessibilityLabel', 'Caro');
    expect(screen.getByTestId(`division-persona-${p.caro}`).props.accessibilityState).toMatchObject({
      checked: false,
    });
    fireEvent.press(screen.getByTestId(`division-persona-${p.caro}`));
    fireEvent.press(screen.getByTestId(`division-persona-${p.juan}`));
    fireEvent.press(screen.getByTestId('division-categoria-comida_fuera'));
    fireEvent.press(screen.getByTestId(`division-origen-${p.bbva}`));
    fireEvent.press(screen.getByTestId('boton-guardar-division'));
    // Cada quien queda una sola vez en «Te deben» (una parte de $1.01 entre 3, no dos).
    expect(p.ctx.libro.saldo(p.caro)).toBeGreaterThan(0);
    expect(p.ctx.libro.saldo(p.caro)).toBeLessThanOrEqual(34);
    expect(p.ctx.libro.saldo(p.juan)).toBeGreaterThan(0);
    expect(p.ctx.libro.saldo(p.juan)).toBeLessThanOrEqual(34);
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
    expect(screen.getByTestId('persona-recordatorio-fecha')).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.getByTestId('persona-recordatorio-fecha')).toHaveProp('accessibilityRole', 'header');
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

  it('con avisos negados ofrece "Abrir Ajustes" (el sistema ya no vuelve a preguntar)', async () => {
    const p = conAmigos();
    cena(p);
    const abrirAjustesSistema = jest.fn();
    const n = { ...notificacionesEnMemoria('denegado'), abrirAjustesSistema };
    renderConSesion(
      p.ctx,
      <ProveedorNotificaciones notificaciones={n}>
        <PantallaPersona personaId={p.caro} alVolver={jest.fn()} />
      </ProveedorNotificaciones>,
    );
    expect(screen.queryByTestId('persona-recordatorio-ajustes')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('recordatorio-cobro-2026-10-12'));
    });
    const boton = screen.getByTestId('persona-recordatorio-ajustes');
    expect(boton.props.accessibilityLabel).toBe(BTN_ABRIR_AJUSTES);
    expect(boton).toHaveProp('accessibilityHint', PISTA_ABRIR_AJUSTES_AVISOS);
    fireEvent.press(boton);
    expect(abrirAjustesSistema).toHaveBeenCalledTimes(1);
  });
});

describe('estados vacíos (es-MX)', () => {
  it('persona inexistente', () => {
    const p = conEscenario('e4-01');
    renderConSesion(
      p.ctx,
      <PantallaPersona personaId="contraparte:persona:inexistente" alVolver={jest.fn()} />,
    );
    expect(textoDe('persona-no-encontrada')).toBe(TEXTO_PERSONA_NO_ENCONTRADA);
    expect(screen.getByTestId('persona-no-encontrada').props.accessibilityLabel).toBe(
      etiquetaPersonaNoEncontrada(),
    );
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
    expect(screen.getByTestId('persona-saldo-etiqueta', { includeHiddenElements: true })).toHaveProp(
      'importantForAccessibility',
      'no-hide-descendants',
    );
    expect(textoDe('persona-tip-te-deben')).toBe(TIP_SALDO_TE_DEBEN);
    expect(screen.getByTestId('persona-tip-te-deben')).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.getByTestId('persona-movimientos-lista')).toHaveProp('accessibilityRole', 'list');
  });

  it('cuenta dividida sin contactos', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <FormularioCuentaDividida alGuardar={jest.fn()} />);
    expect(textoDe('division-contactos-vacio')).toBe(TEXTO_CONTACTOS_VACIO);
    expect(screen.getByTestId('division-contactos-vacio').props.accessibilityLabel).toBe(
      etiquetaVacioContactosDivision(),
    );
    expect(screen.getByTestId('division-boton-agregar')).toHaveProp(
      'accessibilityHint',
      PISTA_AGREGAR_PERSONA,
    );
    expect(screen.getByTestId('boton-guardar-division')).toHaveProp(
      'accessibilityHint',
      PISTA_GUARDAR_DIVISION,
    );
  });
});

describe('Ajustes → Datos para cobrar', () => {
  it('titulo de seccion es encabezado TalkBack', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <SeccionDatosCobro />);
    expect(screen.getByTestId('ajustes-datos-cobro-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByText(SECCION_DATOS_COBRO)).toBeTruthy();
    expect(screen.getByTestId('boton-editar-datos-cobro')).toHaveProp(
      'accessibilityHint',
      PISTA_AGREGAR_DATOS_COBRO,
    );
    expect(screen.getByTestId('datos-cobro-resumen')).toHaveTextContent(RESUMEN_VACIO);
    // La fila se lee completa: el título, el resumen y la acción (`PLAN-UX-VOZ` §3.6).
    expect(String(screen.getByTestId('boton-editar-datos-cobro').props.accessibilityLabel)).toContain(
      etiquetaResumenDatosCobro(RESUMEN_VACIO).replace(/[.]$/, ''),
    );
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
    expect(screen.getByTestId('boton-editar-datos-cobro')).toHaveProp(
      'accessibilityHint',
      PISTA_CAMBIAR_DATOS_COBRO,
    );
    expect(screen.getByTestId('boton-borrar-datos-cobro')).toHaveProp(
      'accessibilityHint',
      PISTA_BORRAR_DATOS_COBRO,
    );
    fireEvent.press(screen.getByTestId('boton-borrar-datos-cobro'));
    expect(leerDatosCobro(p.ctx)).toBeNull();
  });
});
