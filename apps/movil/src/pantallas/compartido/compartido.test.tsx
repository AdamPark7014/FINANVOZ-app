import { randomBytes } from 'node:crypto';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Linking, Platform } from 'react-native';
import { crearCriptoNoble } from '@cartera/sincronizacion/noble';
import { ProveedorCompartido } from '../../compartido/ProveedorCompartido';
import { almacenEnMemoria } from '../../db/llave';
import {
  aceptarConsentimiento,
  agregarCuenta,
  agregarGastoCompartido,
  crearGrupoCompartido,
  listarGruposCompartidos,
  MENSAJE_MOVIMIENTO_COMPARTIDO,
  mensajeErrorCompartido,
  obtenerGrupoCompartido,
  type Contexto,
  type DependenciasCompartido,
} from '../../servicios';
import { servidorCompartidoFalso } from '../../servicios/__pruebas__/compartido';
import { nubeFalsa } from '../../servicios/__pruebas__/nube';
import { ProveedorSesion } from '../../sesion/ProveedorSesion';
import { auditar } from '../__pruebas__/accesibilidad';
import { crearMotorFalso, renderConSesion } from '../principal/__pruebas__/arnes';
import { abrirPruebaPantalla } from '../principal/__pruebas__/base';
import { PanelRegistrar } from '../principal/PanelRegistrar';
import { PantallaCuentas } from '../principal/PantallaCuentas';
import { ProveedorAvisos } from '../principal/ProveedorAvisos';
import { matrizQr, tramos } from './CodigoQr';
import { EscanerQr } from './EscanerQr';
import { PantallaCompartidos } from './PantallaCompartidos';
import { PantallaGrupoCompartido, TEXTO_GRUPO_NO_ENCONTRADO } from './PantallaGrupoCompartido';
import {
  BTN_ABRIR_AJUSTES,
  BTN_COMPARTIDOS_CUENTAS,
  TEXTO_CAMARA_BLOQUEADA,
  textoConfirmarAnular,
  ETIQUETA_ACCESIBILIDAD_QR_UNION,
  ETIQUETA_CON_QUIEN_COMPARTES,
  ERROR_NOMBRE_PAREJA,
  MENSAJE_SIN_PAREJA,
  parsearProporcionReparto,
  ETIQUETA_VISTA_CAMARA,
  PISTA_ABRIR_ESCANER,
  PISTA_CANCELAR_ESCANER,
  PISTA_CREAR_CODIGO,
  PISTA_CREAR_CON_ALGUIEN,
  PISTA_ESCANEAR_CODIGO,
  PISTA_ESCRIBIR_NOMBRE_PAREJA,
  INSTRUCCION_PERMISO_CAMARA,
  PISTA_GUARDAR_GASTO_COMPARTIDO,
  PISTA_PERMISO_CAMARA,
  PISTA_VISTA_CAMARA,
  PISTA_AGREGAR_GASTO,
  PISTA_LISTO_TRAS_QR,
  PISTA_VOLVER_GRUPO,
  PISTA_VOLVER_CUENTAS,
  PISTA_CANCELAR_CREAR,
  PISTA_CANCELAR_UNIRSE,
  etiquetaVacioCompartidos,
  etiquetaVacioGrupoMovimientos,
  TEXTO_COMPARTIDOS_VACIO,
  TEXTO_GRUPO_MOVIMIENTOS_VACIO,
  TEXTO_SALIR,
} from './textos';

// La cámara falsa "lee" el QR que la prueba deja en `mockQr` al tocarla.
let mockQr = '';
let mockCamaraConcedida = true;
/** `false`: la cámara se negó y el sistema ya no muestra el diálogo (iPhone). */
let mockCamaraPreguntable = true;
jest.mock('expo-camera', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    useCameraPermissions: () => [
      { granted: mockCamaraConcedida, canAskAgain: mockCamaraPreguntable },
      jest.fn(() => Promise.resolve({ granted: mockCamaraConcedida })),
      jest.fn(() => Promise.resolve({ granted: mockCamaraConcedida })),
    ],
    CameraView: ({
      onBarcodeScanned,
      accessibilityLabel,
      accessibilityHint,
    }: {
      onBarcodeScanned: (r: { data: string }) => void;
      accessibilityLabel?: string;
      accessibilityHint?: string;
    }) => (
      <Pressable
        testID="camara-falsa"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? 'Cámara'}
        accessibilityHint={accessibilityHint}
        onPress={() => onBarcodeScanned({ data: mockQr })}
      >
        <Text>Cámara</Text>
      </Pressable>
    ),
  };
});
jest.mock('expo-screen-capture', () => ({ usePreventScreenCapture: jest.fn() }));

interface Telefono {
  ctx: Contexto;
  deps: DependenciasCompartido;
  cuenta: string;
  cerrar: () => void;
}

function telefono(servidor: ReturnType<typeof servidorCompartidoFalso>, usuario: string): Telefono {
  const p = abrirPruebaPantalla('2026-10-11');
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  const cuenta = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 5_000_000 });
  const deps = {
    cripto: crearCriptoNoble((n) => new Uint8Array(randomBytes(n))),
    almacen: almacenEnMemoria(),
    cliente: servidor.cliente(usuario),
  };
  return { ctx: p.ctx, deps, cuenta, cerrar: p.cerrar };
}

function en(t: Telefono, ui: ReactNode) {
  return render(
    <ProveedorSesion ctx={t.ctx} nube={null}>
      <ProveedorAvisos>
        <ProveedorCompartido deps={t.deps}>{ui}</ProveedorCompartido>
      </ProveedorAvisos>
    </ProveedorSesion>,
  );
}

/** A crea con la pantalla y muestra el QR; B lo escanea con la suya. Devuelve el id del grupo. */
async function vincular(A: Telefono, B: Telefono): Promise<string> {
  const abrirA = jest.fn();
  const a = en(A, <PantallaCompartidos alVolver={jest.fn()} alAbrirGrupo={abrirA} />);
  fireEvent.press(screen.getByTestId('compartidos-crear'));
  fireEvent.changeText(screen.getByTestId('compartidos-nombre'), 'Beto');
  await act(async () => {
    fireEvent.press(screen.getByTestId('compartidos-crear-codigo'));
  });
  expect(screen.getByTestId('compartidos-qr').props.accessibilityLabel).toBe(ETIQUETA_ACCESIBILIDAD_QR_UNION);
  expect(auditar(screen.toJSON() as never)).toEqual([]);
  const [grupo] = listarGruposCompartidos(A.ctx, A.deps.almacen);
  if (!grupo) throw new Error('sin grupo');
  // El QR que dibuja la pantalla es el mismo texto que se escanea.
  const { obtenerLlaveGrupo } = jest.requireActual('../../compartido/llaves');
  expect(obtenerLlaveGrupo(A.deps.almacen, grupo.id)).not.toBeNull();
  mockQr = (a.UNSAFE_getByType(jest.requireActual('./CodigoQr').CodigoQr).props as { texto: string }).texto;
  fireEvent.press(screen.getByTestId('compartidos-listo'));
  expect(abrirA).toHaveBeenCalledWith(grupo.id);
  a.unmount();

  const abrirB = jest.fn();
  const b = en(B, <PantallaCompartidos alVolver={jest.fn()} alAbrirGrupo={abrirB} />);
  fireEvent.press(screen.getByTestId('compartidos-escanear'));
  fireEvent.press(screen.getByTestId('compartidos-abrir-escaner'));
  expect(screen.getByText(ERROR_NOMBRE_PAREJA)).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('compartidos-nombre'), 'Ana');
  fireEvent.press(screen.getByTestId('compartidos-abrir-escaner'));
  await act(async () => {
    fireEvent.press(screen.getByTestId('camara-falsa'));
  });
  await waitFor(() => expect(abrirB).toHaveBeenCalledWith(grupo.id));
  b.unmount();
  return grupo.id;
}

describe('02 §27 · Gastos con tu pareja', () => {
  it('ancla copy del botón en Cuentas', () => {
    expect(BTN_COMPARTIDOS_CUENTAS).toBe('Gastos con tu pareja');
  });

  it('lista vacía: TalkBack título, vacío y Volver', () => {
    const servidor = servidorCompartidoFalso();
    const A = telefono(servidor, 'usuario-a');
    en(A, <PantallaCompartidos alVolver={jest.fn()} alAbrirGrupo={jest.fn()} />);
    expect(screen.getByTestId('compartidos-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('compartidos-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER_CUENTAS);
    expect(screen.getByTestId('compartidos-crear')).toHaveProp('accessibilityRole', 'button');
    expect(screen.getByTestId('compartidos-crear')).toHaveProp('accessibilityHint', PISTA_CREAR_CON_ALGUIEN);
    expect(screen.getByTestId('compartidos-escanear')).toHaveProp('accessibilityRole', 'button');
    expect(screen.getByTestId('compartidos-escanear')).toHaveProp('accessibilityHint', PISTA_ESCANEAR_CODIGO);
    expect(screen.getByTestId('compartidos-vacio')).toHaveTextContent(TEXTO_COMPARTIDOS_VACIO);
    expect(screen.getByTestId('compartidos-vacio').props.accessibilityLabel).toBe(etiquetaVacioCompartidos());
    expect(auditar(screen.toJSON() as never, { etiquetaExplicita: true })).toEqual([]);
    A.cerrar();
  });

  it('TalkBack Listo tras QR y detalle del grupo', async () => {
    const servidor = servidorCompartidoFalso();
    const A = telefono(servidor, 'usuario-a');
    en(A, <PantallaCompartidos alVolver={jest.fn()} alAbrirGrupo={jest.fn()} />);
    fireEvent.press(screen.getByTestId('compartidos-crear'));
    fireEvent.changeText(screen.getByTestId('compartidos-nombre'), 'Beto');
    await act(async () => {
      fireEvent.press(screen.getByTestId('compartidos-crear-codigo'));
    });
    expect(screen.getByTestId('compartidos-listo')).toHaveProp('accessibilityHint', PISTA_LISTO_TRAS_QR);
    A.cerrar();
  });

  it('TalkBack en flujos crear y escanear (`02 §19`)', () => {
    const servidor = servidorCompartidoFalso();
    const A = telefono(servidor, 'usuario-a');
    en(A, <PantallaCompartidos alVolver={jest.fn()} alAbrirGrupo={jest.fn()} />);
    fireEvent.press(screen.getByTestId('compartidos-crear'));
    // "Volver" siempre sale (como el gesto de iPhone); el paso se cierra con su "Cancelar".
    expect(screen.getByTestId('compartidos-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER_CUENTAS);
    expect(screen.getByTestId('compartidos-crear-codigo')).toHaveProp(
      'accessibilityHint',
      PISTA_CREAR_CODIGO,
    );
    expect(screen.getByTestId('compartidos-cancelar')).toHaveProp('accessibilityHint', PISTA_CANCELAR_CREAR);
    fireEvent.press(screen.getByTestId('compartidos-cancelar'));
    fireEvent.press(screen.getByTestId('compartidos-escanear'));
    expect(screen.getByTestId('compartidos-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER_CUENTAS);
    expect(screen.getByTestId('compartidos-cancelar')).toHaveProp('accessibilityHint', PISTA_CANCELAR_UNIRSE);
    expect(screen.getByTestId('compartidos-abrir-escaner')).toHaveProp(
      'accessibilityHint',
      PISTA_ESCRIBIR_NOMBRE_PAREJA,
    );
    fireEvent.changeText(screen.getByTestId('compartidos-nombre'), 'Ana');
    expect(screen.getByTestId('compartidos-abrir-escaner')).toHaveProp(
      'accessibilityHint',
      PISTA_ABRIR_ESCANER,
    );
    fireEvent.press(screen.getByTestId('compartidos-abrir-escaner'));
    expect(screen.getByTestId('escaner-cancelar')).toHaveProp('accessibilityHint', PISTA_CANCELAR_ESCANER);
    A.cerrar();
  });

  it('escáner sin permiso: pista TalkBack en Permitir la cámara', () => {
    mockCamaraConcedida = false;
    render(<EscanerQr alLeer={jest.fn()} alCancelar={jest.fn()} />);
    expect(screen.getByTestId('escaner-permiso')).toHaveProp(
      'accessibilityLabel',
      INSTRUCCION_PERMISO_CAMARA,
    );
    expect(screen.getByTestId('escaner-permiso')).toHaveProp('accessibilityHint', PISTA_PERMISO_CAMARA);
    mockCamaraConcedida = true;
  });

  it('escáner con permiso: pista TalkBack en la vista de cámara', () => {
    mockCamaraConcedida = true;
    render(<EscanerQr alLeer={jest.fn()} alCancelar={jest.fn()} />);
    expect(screen.getByTestId('camara-falsa')).toHaveProp('accessibilityLabel', ETIQUETA_VISTA_CAMARA);
    expect(screen.getByTestId('camara-falsa')).toHaveProp('accessibilityHint', PISTA_VISTA_CAMARA);
  });

  it('Cuentas abre Gastos compartidos con etiqueta TalkBack', () => {
    const p = abrirPruebaPantalla('2026-10-11');
    const alAbrir = jest.fn();
    renderConSesion(p.ctx, <PantallaCuentas alAbrirAjustes={jest.fn()} alAbrirCompartidos={alAbrir} />);
    expect(screen.getByTestId('seccion-compartidos-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('boton-compartidos')).toHaveProp('accessibilityRole', 'button');
    expect(screen.getByTestId('boton-compartidos').props.accessibilityLabel).toBe(BTN_COMPARTIDOS_CUENTAS);
    fireEvent.press(screen.getByTestId('boton-compartidos'));
    expect(alAbrir).toHaveBeenCalled();
    expect(auditar(screen.toJSON() as never, { etiquetaExplicita: true })).toEqual([]);
    p.cerrar();
  });

  it('CA-M16-03 · crear con alguien, escanear, agregar y saldar: los dos ven lo mismo', async () => {
    const servidor = servidorCompartidoFalso();
    const A = telefono(servidor, 'usuario-a');
    const B = telefono(servidor, 'usuario-b');
    const grupo = await vincular(A, B);

    // B agrega "Súper 1,200, pagué yo, 40 % mío".
    const b = en(B, <PantallaGrupoCompartido grupoId={grupo} alVolver={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('grupo-saldo').props.children).toBe('Están a mano'));
    expect(screen.getByTestId('grupo-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('grupo-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER_GRUPO);
    expect(screen.getByTestId('grupo-lo-compartido-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('grupo-agregar')).toHaveProp('accessibilityHint', PISTA_AGREGAR_GASTO);
    expect(screen.getByTestId('grupo-movimientos-vacio')).toHaveTextContent(TEXTO_GRUPO_MOVIMIENTOS_VACIO);
    expect(screen.getByTestId('grupo-movimientos-vacio').props.accessibilityLabel).toBe(
      etiquetaVacioGrupoMovimientos(),
    );
    fireEvent.press(screen.getByTestId('grupo-agregar'));
    fireEvent.changeText(screen.getByTestId('compartido-total'), '1200');
    fireEvent.changeText(screen.getByTestId('compartido-descripcion'), 'Súper');
    fireEvent.press(screen.getByTestId('compartido-reparto-4000'));
    fireEvent.press(screen.getByTestId(`compartido-cuenta-${B.cuenta}`));
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    await act(async () => {
      fireEvent.press(screen.getByTestId('compartido-guardar'));
    });
    await waitFor(() => expect(screen.queryByTestId('grupo-pendientes')).toBeNull());
    expect(screen.getByTestId('grupo-saldo').props.children).toBe('Ana te debe $720');
    expect(screen.getByTestId('grupo-saldo').props.accessibilityLabel).not.toMatch(/\$|\d/);
    b.unmount();

    // A abre el grupo, lo ve y salda.
    const a = en(A, <PantallaGrupoCompartido grupoId={grupo} alVolver={jest.fn()} />);
    await waitFor(() =>
      expect(screen.getByTestId('grupo-saldo').props.children).toBe('Le debes $720 a Beto'),
    );
    expect(screen.getByText('Súper')).toBeTruthy();
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    fireEvent.press(screen.getByTestId('grupo-saldar-abrir'));
    fireEvent.press(screen.getByTestId(`grupo-saldar-cuenta-${A.cuenta}`));
    await act(async () => {
      fireEvent.press(screen.getByTestId('grupo-saldar-confirmar'));
    });
    await waitFor(() => expect(screen.getByTestId('grupo-saldo').props.children).toBe('Están a mano'));
    a.unmount();
    A.cerrar();
    B.cerrar();
  });

  it('CA-M16-05 · dejar de compartir avisa y cierra para los dos', async () => {
    const servidor = servidorCompartidoFalso();
    const A = telefono(servidor, 'usuario-a');
    const B = telefono(servidor, 'usuario-b');
    const grupo = await vincular(A, B);

    const a = en(A, <PantallaGrupoCompartido grupoId={grupo} alVolver={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('grupo-saldo').props.children).toBe('Están a mano'));
    fireEvent.press(screen.getByTestId('grupo-salir-abrir'));
    expect(screen.getByText(TEXTO_SALIR)).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByTestId('grupo-salir-confirmar'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('grupo-aviso-cierre').props.children).toBe('Cerraste el grupo compartido'),
    );
    expect(screen.queryByTestId('grupo-agregar')).toBeNull();
    a.unmount();

    const b = en(B, <PantallaCompartidos alVolver={jest.fn()} alAbrirGrupo={jest.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/Ana cerró el grupo compartido/)).toBeTruthy());
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    b.unmount();
    A.cerrar();
    B.cerrar();
  });

  it('un QR que no es de Finanvoz dice qué hacer', async () => {
    const servidor = servidorCompartidoFalso();
    const B = telefono(servidor, 'usuario-b');
    en(B, <PantallaCompartidos alVolver={jest.fn()} alAbrirGrupo={jest.fn()} />);
    fireEvent.press(screen.getByTestId('compartidos-escanear'));
    fireEvent.changeText(screen.getByTestId('compartidos-nombre'), 'Ana');
    fireEvent.press(screen.getByTestId('compartidos-abrir-escaner'));
    mockQr = 'https://ejemplo.com/promo';
    await act(async () => {
      fireEvent.press(screen.getByTestId('camara-falsa'));
    });
    await waitFor(() =>
      expect(
        screen.getByText('Ese código no es de Finanvoz. Escanea el que aparece en la app de tu pareja.'),
      ).toBeTruthy(),
    );
    B.cerrar();
  });

  it('dictar "Súper 1,200, pagué yo, 60/40" pide vincularse; con pareja confirma con el resumen y guarda', async () => {
    const servidor = servidorCompartidoFalso();
    const A = telefono(servidor, 'usuario-a');
    en(A, <PanelRegistrar abiertoAlInicio motor={crearMotorFalso().motor} />);
    const dictar = async (frase: string) => {
      fireEvent.changeText(screen.getByTestId('campo-registrar'), frase);
      await act(async () => {
        fireEvent.press(screen.getByTestId('boton-enviar-registro'));
      });
    };
    await dictar('Súper 1,200, pagué yo, 60/40');
    expect(screen.getByText(MENSAJE_SIN_PAREJA)).toBeTruthy();

    const creado = await crearGrupoCompartido(A.ctx, A.deps, 'Beto');
    if (!creado.ok) throw new Error(creado.error);
    await dictar('Súper 1,200, pagué yo, 60/40');
    expect(screen.getByTestId('compartido-resumen').props.children).toBe(
      'Súper $1,200.00 · pagaste tú · tú 60 % / tu pareja 40 %',
    );
    expect(screen.getByTestId('compartido-resumen')).toHaveProp('importantForAccessibility', 'yes');
    expect(screen.getByTestId('compartido-resumen').props.accessibilityLabel).not.toMatch(/\$/);
    expect(screen.getByTestId('compartido-resumen').props.accessibilityLabel).toMatch(/mil doscientos/i);
    expect(screen.getByTestId('compartido-formulario-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('compartido-guardar')).toHaveProp(
      'accessibilityHint',
      PISTA_GUARDAR_GASTO_COMPARTIDO,
    );
    expect(obtenerGrupoCompartido(A.ctx, A.deps.almacen, creado.grupoId).movimientos).toHaveLength(0);
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    fireEvent.press(screen.getByTestId(`compartido-cuenta-${A.cuenta}`));
    await act(async () => {
      fireEvent.press(screen.getByTestId('compartido-guardar'));
    });
    await waitFor(() => {
      expect(screen.queryByTestId('formulario-gasto-compartido')).toBeNull();
    });
    await waitFor(() => {
      expect(obtenerGrupoCompartido(A.ctx, A.deps.almacen, creado.grupoId).saldo.texto).toBe(
        'Beto te debe $480',
      );
    });
    A.cerrar();
  });

  it('con dos grupos y sin decir con quién, primero pregunta', async () => {
    const servidor = servidorCompartidoFalso();
    const A = telefono(servidor, 'usuario-a');
    for (const nombre of ['Beto', 'Caro']) {
      const r = await crearGrupoCompartido(A.ctx, A.deps, nombre);
      if (!r.ok) throw new Error(r.error);
    }
    en(A, <PanelRegistrar abiertoAlInicio motor={crearMotorFalso().motor} />);
    fireEvent.changeText(screen.getByTestId('campo-registrar'), 'tacos 400, pagó ella, mitad y mitad');
    await act(async () => {
      fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    });
    expect(screen.getByTestId('confirmar-compartido-titulo')).toHaveTextContent(ETIQUETA_CON_QUIEN_COMPARTES);
    const [, caro] = listarGruposCompartidos(A.ctx, A.deps.almacen);
    fireEvent.press(screen.getByTestId(`confirmar-compartido-grupo-${caro?.id}`));
    expect(screen.getByTestId('compartido-resumen').props.children).toBe(
      'Tacos $400.00 · pagó tu pareja · tú 50 % / tu pareja 50 %',
    );
    expect(screen.getByTestId('compartido-quien-otro').props.accessibilityState).toMatchObject({
      selected: true,
    });
    A.cerrar();
  });

  it('pendiente 146 · "borra lo del súper" por voz dice dónde se anula un gasto compartido', async () => {
    const servidor = servidorCompartidoFalso();
    const A = telefono(servidor, 'usuario-a');
    const creado = await crearGrupoCompartido(A.ctx, A.deps, 'Beto');
    if (!creado.ok) throw new Error(creado.error);
    agregarGastoCompartido(A.ctx, A.deps, creado.grupoId, {
      total: 120000,
      pagueYo: true,
      miParteBp: 5000,
      descripcion: 'Súper',
      categoria: 'super',
      cuentaId: A.cuenta,
    });
    const f = nubeFalsa({ 'borra lo del súper': { intencion: 'anular', objetivo: { texto: 'súper' } } });
    render(
      <ProveedorSesion ctx={A.ctx} nube={f.nube}>
        <ProveedorAvisos>
          <ProveedorCompartido deps={A.deps}>
            <PanelRegistrar abiertoAlInicio motor={crearMotorFalso().motor} />
          </ProveedorCompartido>
        </ProveedorAvisos>
      </ProveedorSesion>,
    );
    fireEvent.changeText(screen.getByTestId('campo-registrar'), 'borra lo del súper');
    await act(async () => {
      fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    });
    expect(await screen.findByText(MENSAJE_MOVIMIENTO_COMPARTIDO)).toBeTruthy();
    expect(obtenerGrupoCompartido(A.ctx, A.deps.almacen, creado.grupoId).movimientos).toMatchObject([
      { titulo: 'Súper', anulado: false },
    ]);
    A.cerrar();
  });

  it('pendiente 148 · otra proporción 55/45 y categorías del libro', async () => {
    expect(parsearProporcionReparto('55/45')).toEqual({ ok: true, miParteBp: 5500 });
    expect(parsearProporcionReparto('70 / 20').ok).toBe(false);

    const servidor = servidorCompartidoFalso();
    const A = telefono(servidor, 'usuario-a');
    const B = telefono(servidor, 'usuario-b');
    const grupo = await vincular(A, B);

    const b = en(B, <PantallaGrupoCompartido grupoId={grupo} alVolver={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('grupo-saldo').props.children).toBe('Están a mano'));
    fireEvent.press(screen.getByTestId('grupo-agregar'));
    expect(screen.getByTestId('compartido-categoria-transporte')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('compartido-total'), '1000');
    fireEvent.changeText(screen.getByTestId('compartido-descripcion'), 'Uber');
    fireEvent.press(screen.getByTestId('compartido-categoria-transporte'));
    fireEvent.changeText(screen.getByTestId('compartido-reparto-otra'), '55/45');
    fireEvent.press(screen.getByTestId(`compartido-cuenta-${B.cuenta}`));
    await act(async () => {
      fireEvent.press(screen.getByTestId('compartido-guardar'));
    });
    await waitFor(() => expect(screen.getByTestId('grupo-saldo').props.children).toBe('Ana te debe $450'));
    b.unmount();
    A.cerrar();
    B.cerrar();
  });

  it('el QR se dibuja con tramos que cubren cada fila', () => {
    const m = matrizQr(`FINANVOZ-PAREJA:1:${'0'.repeat(36)}:${'a'.repeat(22)}:${'b'.repeat(43)}`);
    expect((m.length - 17) % 4).toBe(0);
    for (const fila of m) expect(tramos(fila).reduce((s, [l]) => s + l, 0)).toBe(m.length);
    expect(tramos([true, true, false, true])).toEqual([
      [2, true],
      [1, false],
      [1, true],
    ]);
  });
});

describe('Compartido: botones que no llevaban a ningún lado (auditoría B-3 · 4 y 5)', () => {
  /** Grupo de A con un "Súper" que pagó A (Beto le debe), sin que B se haya unido. */
  async function grupoConGasto() {
    const servidor = servidorCompartidoFalso();
    const A = telefono(servidor, 'usuario-a');
    const creado = await crearGrupoCompartido(A.ctx, A.deps, 'Beto');
    if (!creado.ok) throw new Error(creado.error);
    agregarGastoCompartido(A.ctx, A.deps, creado.grupoId, {
      total: 120000,
      pagueYo: true,
      miParteBp: 5000,
      descripcion: 'Súper',
      categoria: 'super',
      cuentaId: A.cuenta,
    });
    const [mov] = obtenerGrupoCompartido(A.ctx, A.deps.almacen, creado.grupoId).movimientos;
    if (!mov) throw new Error('sin movimiento');
    return { A, grupoId: creado.grupoId, movId: mov.id };
  }

  it('sin nube lo dice al abrir, sin pedir nombre ni cámara', () => {
    const servidor = servidorCompartidoFalso();
    const A = telefono(servidor, 'usuario-a');
    en(
      { ...A, deps: { ...A.deps, cliente: null } },
      <PantallaCompartidos alVolver={jest.fn()} alAbrirGrupo={jest.fn()} />,
    );
    expect(screen.getByTestId('compartidos-sin-servicio')).toHaveTextContent(
      mensajeErrorCompartido('sin_servicio'),
    );
    expect(screen.queryByTestId('compartidos-crear')).toBeNull();
    expect(screen.queryByTestId('compartidos-escanear')).toBeNull();
    expect(screen.queryByTestId('compartidos-vacio')).toBeNull();
    A.cerrar();
  });

  it('"Anular" pregunta antes; "Cancelar" lo deja y "Sí, anular" lo anula', async () => {
    const { A, grupoId, movId } = await grupoConGasto();
    en(A, <PantallaGrupoCompartido grupoId={grupoId} alVolver={jest.fn()} />);
    await waitFor(() => expect(screen.queryByTestId('grupo-pendientes')).toBeNull());
    fireEvent.press(screen.getByTestId(`mov-compartido-${movId}-anular`));
    expect(
      within(screen.getByTestId(`mov-compartido-${movId}-confirmacion`)).getByText(
        textoConfirmarAnular('Súper', 'Beto'),
      ),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId(`mov-compartido-${movId}-cancelar-anular`));
    expect(screen.queryByTestId(`mov-compartido-${movId}-confirmacion`)).toBeNull();
    expect(obtenerGrupoCompartido(A.ctx, A.deps.almacen, grupoId).movimientos[0]?.anulado).toBe(false);
    fireEvent.press(screen.getByTestId(`mov-compartido-${movId}-anular`));
    await act(async () => {
      fireEvent.press(screen.getByTestId(`mov-compartido-${movId}-confirmar-anular`));
    });
    await waitFor(() =>
      expect(
        obtenerGrupoCompartido(A.ctx, A.deps.almacen, grupoId).movimientos.find((m) => m.id === movId)
          ?.anulado,
      ).toBe(true),
    );
    A.cerrar();
  });

  it('iPhone: VoiceOver anuncia la pregunta de anular', async () => {
    const { A, grupoId, movId } = await grupoConGasto();
    const plataforma = jest.replaceProperty(Platform, 'OS', 'ios');
    const anunciar = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    try {
      en(A, <PantallaGrupoCompartido grupoId={grupoId} alVolver={jest.fn()} />);
      await waitFor(() => expect(screen.queryByTestId('grupo-pendientes')).toBeNull());
      fireEvent.press(screen.getByTestId(`mov-compartido-${movId}-anular`));
      expect(anunciar).toHaveBeenCalledWith(textoConfirmarAnular('Súper', 'Beto'));
    } finally {
      anunciar.mockRestore();
      plataforma.restore();
      A.cerrar();
    }
  });

  it('"Volver" siempre sale del grupo; "Saldar" se cierra con su "Cancelar"', async () => {
    const { A, grupoId } = await grupoConGasto();
    const alVolver = jest.fn();
    en(A, <PantallaGrupoCompartido grupoId={grupoId} alVolver={alVolver} />);
    await waitFor(() => expect(screen.getByTestId('grupo-saldar-abrir')).toBeTruthy());
    fireEvent.press(screen.getByTestId('grupo-saldar-abrir'));
    fireEvent.press(screen.getByTestId('grupo-saldar-cancelar'));
    expect(screen.queryByTestId('grupo-saldar')).toBeNull();
    fireEvent.press(screen.getByTestId('grupo-saldar-abrir'));
    expect(screen.getByTestId('grupo-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER_GRUPO);
    fireEvent.press(screen.getByTestId('grupo-volver'));
    expect(alVolver).toHaveBeenCalledTimes(1);
    A.cerrar();
  });

  it('un enlace a un grupo que ya no existe no tumba la app: lo dice y deja volver', () => {
    const servidor = servidorCompartidoFalso();
    const A = telefono(servidor, 'a');
    const alVolver = jest.fn();
    en(A, <PantallaGrupoCompartido grupoId="00000000-0000-4000-8000-000000000000" alVolver={alVolver} />);
    expect(screen.getByTestId('grupo-no-encontrado')).toHaveTextContent(TEXTO_GRUPO_NO_ENCONTRADO);
    fireEvent.press(screen.getByTestId('grupo-volver'));
    expect(alVolver).toHaveBeenCalledTimes(1);
    A.cerrar();
  });

  it('grupo sin nube: no ofrece código, volver a vincular ni salir', async () => {
    const { A, grupoId } = await grupoConGasto();
    en(
      { ...A, deps: { ...A.deps, cliente: null } },
      <PantallaGrupoCompartido grupoId={grupoId} alVolver={jest.fn()} />,
    );
    await waitFor(() =>
      expect(screen.getByTestId('error-formulario')).toHaveTextContent(
        mensajeErrorCompartido('sin_servicio'),
      ),
    );
    expect(screen.queryByTestId('grupo-mostrar-codigo')).toBeNull();
    expect(screen.queryByTestId('grupo-salir-abrir')).toBeNull();
    expect(screen.queryByTestId('grupo-revincular-escanear')).toBeNull();
    A.cerrar();
  });

  it('cámara negada sin poder volver a preguntar: "Abrir Ajustes"', () => {
    mockCamaraConcedida = false;
    mockCamaraPreguntable = false;
    const abrir = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    try {
      render(<EscanerQr alLeer={jest.fn()} alCancelar={jest.fn()} />);
      expect(screen.getByTestId('escaner-bloqueada')).toHaveTextContent(TEXTO_CAMARA_BLOQUEADA);
      expect(screen.queryByTestId('escaner-permiso')).toBeNull();
      expect(screen.getByTestId('escaner-abrir-ajustes').props.accessibilityLabel).toBe(BTN_ABRIR_AJUSTES);
      fireEvent.press(screen.getByTestId('escaner-abrir-ajustes'));
      expect(abrir).toHaveBeenCalledTimes(1);
    } finally {
      abrir.mockRestore();
      mockCamaraConcedida = true;
      mockCamaraPreguntable = true;
    }
  });
});
