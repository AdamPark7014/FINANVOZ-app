import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { TEXTO_RECHAZO, type ArchivoCfdi, type Contexto } from '../../servicios';
import {
  armarZip,
  configFiscalPrueba,
  CONSULTA_MEDICA,
  CONSULTA_MEDICA_NUBE,
  deduccionE13,
  uuidDe,
} from '../../servicios/__pruebas__/fiscal';
import { nubeFalsa } from '../../servicios/__pruebas__/nube';
import { crearPersona } from '../../servicios/personas';
import { auditar } from '../__pruebas__/accesibilidad';
import { activarPlus, conEscenario } from '../principal/__pruebas__/base';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from '../principal/__pruebas__/arnes';
import { PantallaCuentas } from '../principal/PantallaCuentas';
import { PantallaHoy } from '../principal/PantallaHoy';
import type { ArchivosFacturas } from './archivos';
import { ImportarCompartidas, PantallaDeducciones } from './PantallaDeducciones';
import {
  AVISO_DEDUCIBLE_EFECTIVO,
  LEYENDA_ESTIMACION,
  MENSAJE_SIN_PARAMETROS,
  TEXTO_FACTURAS_VACIO,
  TEXTO_IMPORTAR_VACIO,
} from './textos';

const CARPETA_CFDI = join(__dirname, '../../../../../fixtures/cfdi');

/** CA-M12-02: `fixtures/cfdi` como un ZIP armado en la prueba, como el que se comparte desde el portal del SAT. */
function zipFixture(): ArchivoCfdi {
  const archivos = readdirSync(CARPETA_CFDI)
    .filter((n) => n.endsWith('.xml'))
    .sort()
    .map((nombre) => ({ nombre, bytes: new Uint8Array(readFileSync(join(CARPETA_CFDI, nombre))) }));
  return { nombre: 'facturas.zip', bytes: armarZip(archivos) };
}

const textoDe = (testID: string) => {
  const hijos = screen.getByTestId(testID).props.children as unknown;
  return Array.isArray(hijos) ? hijos.join('') : String(hijos);
};

const selectorFalso = (): ArchivosFacturas => ({ elegir: jest.fn(async () => [zipFixture()]) });

function preparar({ plus = true, config = true }: { plus?: boolean; config?: boolean } = {}): Contexto {
  const p = conEscenario('e4-01');
  if (plus) activarPlus(p.ctx);
  return config ? { ...p.ctx, configFiscal: configFiscalPrueba() } : p.ctx;
}

async function importarDesdePantalla() {
  await act(async () => {
    fireEvent.press(screen.getByTestId('deducciones-importar'));
  });
}

function llenarPerfil(rfc: string, ingresos: string) {
  fireEvent.changeText(screen.getByTestId('perfil-rfc'), rfc);
  fireEvent.changeText(screen.getByTestId('perfil-ingresos'), ingresos);
  fireEvent.press(screen.getByTestId('perfil-guardar'));
}

describe('Importar por la hoja de compartir (CA-M12-02)', () => {
  it('el ZIP de fixtures/cfdi: "Importé 8 facturas; 1 no es versión 4.0"; compartirlo otra vez no duplica', async () => {
    const ctx = preparar({ plus: false, config: false });
    const leer = jest.fn(async () => [zipFixture()]);
    const ver = jest.fn();
    const r = renderConSesion(ctx, <ImportarCompartidas leer={leer} alVerDeducciones={ver} />);
    expect(await screen.findByTestId('importacion-resumen')).toHaveTextContent(
      'Importé 8 facturas; 1 no es versión 4.0',
    );
    expect(textoDe('importacion-rechazo-0')).toBe(
      `facturas.zip › c09_version_33.xml: ${TEXTO_RECHAZO.version_no_soportada}`,
    );
    fireEvent.press(screen.getByTestId('importar-ver-deducciones'));
    expect(ver).toHaveBeenCalled();
    r.unmount();

    renderConSesion(ctx, <ImportarCompartidas leer={leer} alVerDeducciones={ver} />);
    expect(await screen.findByTestId('importacion-resumen')).toHaveTextContent(
      'No importé facturas nuevas; 8 ya las tenías y 1 no es versión 4.0',
    );
    expect(leer).toHaveBeenCalledTimes(2);
  });

  it('si no llegó ningún archivo o no se pudo leer, lo dice', async () => {
    const ctx = preparar();
    const r = renderConSesion(
      ctx,
      <ImportarCompartidas leer={async () => []} alVerDeducciones={jest.fn()} />,
    );
    expect(screen.getByTestId('importar-vacio')).toHaveTextContent(TEXTO_IMPORTAR_VACIO);
    r.unmount();
    renderConSesion(
      ctx,
      <ImportarCompartidas leer={() => Promise.reject(new Error('x'))} alVerDeducciones={jest.fn()} />,
    );
    expect(await screen.findByTestId('error-formulario')).toHaveTextContent(
      'No pude leer esos archivos. Intenta de nuevo.',
    );
  });
});

describe('Deducciones (02 §24, CA-M12-03)', () => {
  it('primera vez, importar, alumno, nivel y lentes: "Llevas $25,900"; "Ya la pagué" por transferencia: $30,900', async () => {
    const ctx = preparar();
    const archivos = selectorFalso();
    renderConSesion(ctx, <PantallaDeducciones alVolver={jest.fn()} archivos={archivos} />);
    expect(screen.getByText(/Para estimar, necesito tu RFC, tus ingresos brutos del año/)).toBeTruthy();

    const v = deduccionE13('E13-10');
    llenarPerfil('PEPJ800101AB', '300,000');
    expect(screen.getByTestId('error-formulario')).toHaveTextContent(/Revisa tu RFC/);
    llenarPerfil(v.rfc.toLowerCase(), '300,000');
    expect(screen.queryByTestId('deducciones-perfil')).toBeNull();

    await importarDesdePantalla();
    expect(archivos.elegir).toHaveBeenCalled();
    expect(textoDe('importacion-resumen')).toBe('Importé 8 facturas; 1 no es versión 4.0');

    // Etiquetas de E13-10 por la pantalla: alumno y nivel de las dos colegiaturas y los lentes.
    for (const [uuid, e] of Object.entries(v.etiquetas)) {
      const id = `factura-${uuid}`;
      if (e['lentes'] === true) fireEvent.press(screen.getByTestId(`${id}-lentes`));
      if (typeof e['alumno'] === 'string') {
        fireEvent.changeText(screen.getByTestId(`${id}-alumno`), e['alumno']);
        fireEvent.press(screen.getByTestId(`${id}-nivel-${String(e['nivel'])}`));
        fireEvent.press(screen.getByTestId(`${id}-guardar-alumno`));
      }
    }
    expect(textoDe('deducciones-titulo')).toBe('Llevas $25,900 deducibles en 2026 (estimación)');
    expect(textoDe('deducciones-tipo-D01')).toBe('Médicos, dentista y hospital: $4,000');
    expect(textoDe('deducciones-tipo-D07')).toBe('Seguros de gastos médicos: $9,000');
    expect(textoDe('deducciones-tipo-D10')).toBe('Colegiaturas: $12,900');
    const hospital = uuidDe('c08_hospital_ppd.xml');
    expect(textoDe(`no-deducible-${uuidDe('c02_medico_efectivo.xml')}`)).toBe(
      'CONSULTORIO FICTICIO · $800: lo pagaste en efectivo',
    );
    expect(textoDe(`no-deducible-${uuidDe('c07_gasolina.xml')}`)).toBe(
      'GASOLINERA FICTICIA · $1,000: no es un gasto deducible',
    );
    expect(textoDe(`no-deducible-${hospital}`)).toBe(
      'HOSPITAL FICTICIO · $5,000: factura en pagos sin confirmar',
    );
    expect(textoDe('deducciones-ahorro')).toMatch(/agrega tu base gravable/);
    expect(screen.getByTestId('deducciones-leyenda')).toHaveTextContent(LEYENDA_ESTIMACION);

    fireEvent.press(screen.getByTestId(`factura-${hospital}-ya-la-pague`));
    for (const forma of ['Transferencia', 'Tarjeta', 'Efectivo', 'Cheque'])
      expect(screen.getByText(forma)).toBeTruthy();
    fireEvent.press(screen.getByTestId(`factura-${hospital}-forma-transferencia`));
    expect(textoDe('deducciones-titulo')).toBe('Llevas $30,900 deducibles en 2026 (estimación)');
    expect(screen.queryByTestId(`no-deducible-${hospital}`)).toBeNull();
    expect(textoDe(`factura-${hospital}-pagada`)).toBe('Pagada con transferencia');
    // Todo lo tocable con rol y nombre, sin texto que se corte (`02 §15`).
    expect(auditar(screen.toJSON())).toEqual([]);
  });

  it('con base gravable dice cuánto ISR podrías pagar de menos', async () => {
    const ctx = preparar();
    renderConSesion(ctx, <PantallaDeducciones alVolver={jest.fn()} archivos={selectorFalso()} />);
    fireEvent.changeText(screen.getByTestId('perfil-base'), '300,000');
    llenarPerfil('PEPJ800101AB1', '300,000');
    await importarDesdePantalla();
    expect(textoDe('deducciones-ahorro')).toMatch(/^Podrías pagar unos \$[\d,]+ menos de ISR$/);
  });

  it('con config/fiscal/2026.json por validar: lista las facturas y explica, sin cifras de deducción', async () => {
    const ctx = preparar({ config: false });
    renderConSesion(ctx, <PantallaDeducciones alVolver={jest.fn()} archivos={selectorFalso()} />);
    llenarPerfil('PEPJ800101AB1', '300,000');
    await importarDesdePantalla();
    expect(screen.getByTestId('deducciones-sin-parametros')).toHaveTextContent(MENSAJE_SIN_PARAMETROS);
    expect(screen.queryByTestId('deducciones-titulo')).toBeNull();
    expect(screen.queryByText(/deducibles/)).toBeNull();
    expect(screen.getByTestId(`factura-${uuidDe('c01_dentista_debito.xml')}`)).toBeTruthy();
    expect(screen.getByTestId('deducciones-leyenda')).toHaveTextContent(LEYENDA_ESTIMACION);
  });

  it('en Gratis explica que es de Plus', () => {
    const ctx = preparar({ plus: false });
    renderConSesion(ctx, <PantallaDeducciones alVolver={jest.fn()} archivos={selectorFalso()} />);
    expect(screen.getByTestId('puerta-plus')).toBeTruthy();
    expect(screen.queryByTestId('pantalla-deducciones')).toBeNull();
  });

  it('Cuentas abre Deducciones', () => {
    const ctx = preparar();
    const alAbrir = jest.fn();
    renderConSesion(ctx, <PantallaCuentas alAbrirAjustes={jest.fn()} alAbrirDeducciones={alAbrir} />);
    fireEvent.press(screen.getByTestId('boton-deducciones'));
    expect(alAbrir).toHaveBeenCalled();
  });

  it('cancelada, importada por error y beneficiario de lentes', async () => {
    const ctx = preparar();
    const luisaId = crearPersona(ctx, { nombre: 'Luisa' });
    renderConSesion(ctx, <PantallaDeducciones alVolver={jest.fn()} archivos={selectorFalso()} />);
    llenarPerfil('PEPJ800101AB1', '300,000');
    await importarDesdePantalla();

    const dentista = uuidDe('c01_dentista_debito.xml');
    const lentes = uuidDe('c03_lentes_tarjeta.xml');
    fireEvent.press(screen.getByTestId(`factura-${dentista}-cancelada`));
    expect(textoDe(`factura-${dentista}-estado`)).toMatch(/cancelada/i);

    fireEvent.press(screen.getByTestId(`factura-${dentista}-ocultar`));
    expect(screen.queryByTestId(`factura-${dentista}`)).toBeNull();
    expect(screen.getByTestId('deducciones-ocultas-titulo')).toBeTruthy();
    fireEvent.press(screen.getByTestId(`factura-oculta-${dentista}-recuperar`));
    expect(screen.getByTestId(`factura-${dentista}`)).toBeTruthy();

    fireEvent.press(screen.getByTestId(`factura-${lentes}-lentes`));
    fireEvent.press(screen.getByTestId(`factura-${lentes}-beneficiario-p:${luisaId}`));
    expect(screen.getByTestId(`factura-${lentes}-beneficiario-p:${luisaId}`)).toBeTruthy();
  });
});

describe('Aviso preventivo (02 §24, CA-M12-04)', () => {
  async function escribir(frase: string) {
    if (!screen.queryByTestId('campo-registrar')) fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.changeText(screen.getByTestId('campo-registrar'), frase);
    await act(async () => {
      fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    });
  }

  it('registrar "consulta médica de 800 en efectivo" sin internet muestra el aviso; otro gasto lo quita', async () => {
    const ctx = preparar({ plus: false, config: false });
    renderConSesion(ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    await escribir(CONSULTA_MEDICA);
    const aviso = await screen.findByTestId('aviso-deducible');
    expect(within(aviso).getByText(AVISO_DEDUCIBLE_EFECTIVO)).toHaveTextContent(
      'Si lo pagas con tarjeta o transferencia y pides factura, lo puedes deducir.',
    );
    await escribir('coca 25 en efectivo');
    expect(screen.queryByTestId('aviso-deducible')).toBeNull();
  });

  it('"Entendido" lo cierra (frase que interpreta la nube)', async () => {
    const ctx = preparar();
    const f = nubeFalsa({ [CONSULTA_MEDICA_NUBE.texto]: CONSULTA_MEDICA_NUBE.interpretacion });
    renderConSesion(
      ctx,
      <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />,
      f.nube,
    );
    await escribir(CONSULTA_MEDICA_NUBE.texto);
    fireEvent.press(await screen.findByTestId('aviso-deducible-cerrar'));
    expect(screen.queryByTestId('aviso-deducible')).toBeNull();
  });
});
