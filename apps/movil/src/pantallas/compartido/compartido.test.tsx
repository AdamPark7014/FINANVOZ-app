import { randomBytes } from 'node:crypto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
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
import { PantallaCompartidos } from './PantallaCompartidos';
import { PantallaGrupoCompartido } from './PantallaGrupoCompartido';
import {
  BTN_COMPARTIDOS_CUENTAS,
  ETIQUETA_ACCESIBILIDAD_QR_UNION,
  ETIQUETA_CON_QUIEN_COMPARTES,
  ERROR_NOMBRE_PAREJA,
  MENSAJE_COMPARTIDO_GUARDADO,
  MENSAJE_SIN_PAREJA,
  parsearProporcionReparto,
  PISTA_ABRIR_ESCANER,
  PISTA_CANCELAR_ESCANER,
  PISTA_CREAR_CODIGO,
  PISTA_CREAR_CON_ALGUIEN,
  PISTA_ESCANEAR_CODIGO,
  PISTA_PERMISO_CAMARA,
  PISTA_VOLVER_CUENTAS,
  PISTA_VOLVER_LISTA,
  etiquetaVacioCompartidos,
  etiquetaVacioGrupoMovimientos,
  TEXTO_COMPARTIDOS_VACIO,
  TEXTO_GRUPO_MOVIMIENTOS_VACIO,
  TEXTO_SALIR,
} from './textos';

// La cámara falsa "lee" el QR que la prueba deja en `mockQr` al tocarla.
let mockQr = '';
let mockCamaraConcedida = true;
jest.mock('expo-camera', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    useCameraPermissions: () => [{ granted: mockCamaraConcedida }, jest.fn()],
    CameraView: ({ onBarcodeScanned }: { onBarcodeScanned: (r: { data: string }) => void }) => (
      <Pressable
        testID="camara-falsa"
        accessibilityRole="button"
        accessibilityLabel="Cámara"
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

  it('TalkBack en flujos crear y escanear (`02 §19`)', () => {
    const servidor = servidorCompartidoFalso();
    const A = telefono(servidor, 'usuario-a');
    en(A, <PantallaCompartidos alVolver={jest.fn()} alAbrirGrupo={jest.fn()} />);
    fireEvent.press(screen.getByTestId('compartidos-crear'));
    expect(screen.getByTestId('compartidos-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER_LISTA);
    expect(screen.getByTestId('compartidos-crear-codigo')).toHaveProp('accessibilityHint', PISTA_CREAR_CODIGO);
    fireEvent.press(screen.getByTestId('compartidos-volver'));
    fireEvent.press(screen.getByTestId('compartidos-escanear'));
    expect(screen.getByTestId('compartidos-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER_LISTA);
    expect(screen.getByTestId('compartidos-abrir-escaner')).toHaveProp('accessibilityHint', PISTA_ABRIR_ESCANER);
    fireEvent.changeText(screen.getByTestId('compartidos-nombre'), 'Ana');
    fireEvent.press(screen.getByTestId('compartidos-abrir-escaner'));
    expect(screen.getByTestId('escaner-cancelar')).toHaveProp('accessibilityHint', PISTA_CANCELAR_ESCANER);
    expect(auditar(screen.toJSON() as never, { etiquetaExplicita: true })).toEqual([]);
    A.cerrar();
  });

  it('escáner sin permiso: pista TalkBack en Permitir la cámara', () => {
    jest.doMock('expo-camera', () => {
      const { Pressable, Text } = jest.requireActual('react-native');
      return {
        useCameraPermissions: () => [{ granted: false }, jest.fn()],
        CameraView: () => null,
      };
    });
    const { EscanerQr: EscanerSinPermiso } = jest.requireActual('./EscanerQr');
    render(<EscanerSinPermiso alLeer={jest.fn()} alCancelar={jest.fn()} />);
    expect(screen.getByTestId('escaner-permiso')).toHaveProp('accessibilityHint', PISTA_PERMISO_CAMARA);
  });

  it('Cuentas abre Gastos compartidos con etiqueta TalkBack', () => {
    const p = abrirPruebaPantalla('2026-10-11');
    const alAbrir = jest.fn();
    renderConSesion(
      p.ctx,
      <PantallaCuentas alAbrirAjustes={jest.fn()} alAbrirCompartidos={alAbrir} />,
    );
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
    await waitFor(() => expect(screen.getByText('Ana cerró el grupo compartido')).toBeTruthy());
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
    expect(obtenerGrupoCompartido(A.ctx, A.deps.almacen, creado.grupoId).movimientos).toHaveLength(0);
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    fireEvent.press(screen.getByTestId(`compartido-cuenta-${A.cuenta}`));
    await act(async () => {
      fireEvent.press(screen.getByTestId('compartido-guardar'));
    });
    expect(await screen.findByText(MENSAJE_COMPARTIDO_GUARDADO)).toBeTruthy();
    expect(screen.queryByTestId('formulario-gasto-compartido')).toBeNull();
    expect(obtenerGrupoCompartido(A.ctx, A.deps.almacen, creado.grupoId).saldo.texto).toBe(
      'Beto te debe $480',
    );
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
    expect(screen.getByText(ETIQUETA_CON_QUIEN_COMPARTES)).toBeTruthy();
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
