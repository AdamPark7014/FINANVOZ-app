import { randomBytes } from 'node:crypto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { crearCriptoNoble } from '@cartera/sincronizacion/noble';
import { ProveedorCompartido } from '../../compartido/ProveedorCompartido';
import { almacenEnMemoria } from '../../db/llave';
import {
  aceptarConsentimiento,
  agregarCuenta,
  listarGruposCompartidos,
  type Contexto,
  type DependenciasCompartido,
} from '../../servicios';
import { servidorCompartidoFalso } from '../../servicios/__pruebas__/compartido';
import { ProveedorSesion } from '../../sesion/ProveedorSesion';
import { auditar } from '../__pruebas__/accesibilidad';
import { abrirPruebaPantalla } from '../principal/__pruebas__/base';
import { ProveedorAvisos } from '../principal/ProveedorAvisos';
import { matrizQr, tramos } from './CodigoQr';
import { PantallaCompartidos } from './PantallaCompartidos';
import { PantallaGrupoCompartido } from './PantallaGrupoCompartido';

// La cámara falsa "lee" el QR que la prueba deja en `mockQr` al tocarla.
let mockQr = '';
jest.mock('expo-camera', () => {
  const { Pressable, Text } = jest.requireActual('react-native');
  return {
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
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
  expect(screen.getByTestId('compartidos-qr').props.accessibilityLabel).toBe(
    'Código QR para unirse a tu grupo compartido',
  );
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
  expect(screen.getByText('Escribe cómo se llama tu pareja.')).toBeTruthy();
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
  it('CA-M16-03 · crear con alguien, escanear, agregar y saldar: los dos ven lo mismo', async () => {
    const servidor = servidorCompartidoFalso();
    const A = telefono(servidor, 'usuario-a');
    const B = telefono(servidor, 'usuario-b');
    const grupo = await vincular(A, B);

    // B agrega "Súper 1,200, pagué yo, 40 % mío".
    const b = en(B, <PantallaGrupoCompartido grupoId={grupo} alVolver={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('grupo-saldo').props.children).toBe('Están a mano'));
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
    expect(
      screen.getByText('Si sales, el grupo se cierra para los dos. Cada quien conserva lo que ya registró.'),
    ).toBeTruthy();
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
