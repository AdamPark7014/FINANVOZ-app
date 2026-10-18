import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { PlainDate, Regla } from '@cartera/core';
import {
  aceptarConsentimiento,
  agregarCuenta,
  aportarTanda,
  cobrarTanda,
  configurarIngreso,
  crearTanda,
  detalleTanda,
  listarOcurrencias,
  listarTandas,
} from '../../servicios';
import { nubeFalsa } from '../../servicios/__pruebas__/nube';
import { formatearCentavos } from '../../ui';
import { abrirPruebaPantalla, golden, vector } from '../principal/__pruebas__/base';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from '../principal/__pruebas__/arnes';
import { PantallaHoy } from '../principal/PantallaHoy';
import { PantallaTanda } from './PantallaTanda';
import { PantallaTandas } from './PantallaTandas';
import {
  EJEMPLO_NOMBRE_TANDA,
  ETIQUETA_GUARDAR_TANDA,
  MENSAJE_TANDA_GUARDADA,
  MENSAJE_TODAVIA_NO_APORTACION,
  MENSAJE_TODAVIA_NO_COBRO,
  PREGUNTA_HOY_COBRO,
  PREGUNTA_YA_DISTE,
  TEXTO_NO_ES_INGRESO,
  TEXTO_TANDA_NO_ENCONTRADA,
  PISTA_VOLVER,
  PISTA_VOLVER_DETALLE,
  TEXTO_TANDAS_VACIO,
  TITULO_TANDAS,
  mensajeAportacion,
  mensajeCobro,
  textoAportado,
  textoDespuesRondaRiesgo,
  textoEnRiesgo,
  textoLineaRonda,
  textoPorAportar,
  textoYaEmpezoCompleto,
} from './textos';

interface RondaVector {
  t: number;
  fecha: PlainDate;
  en_riesgo: number;
  aportado: number;
  por_aportar: number;
}
interface VectorE11 {
  aportacion: number;
  participantes: number;
  turno: number;
  regla: Regla;
  inicio: PlainDate;
  hoy?: PlainDate;
  esperado: unknown;
}

const textoDe = (testID: string) => {
  const hijos = screen.getByTestId(testID).props.children as unknown;
  return Array.isArray(hijos) ? hijos.join('') : String(hijos);
};

function preparar(hoy: PlainDate) {
  const p = abrirPruebaPantalla(hoy);
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 1_000_000 });
  const efectivo = agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 100_000 });
  configurarIngreso(p.ctx, { monto: 1_500_000, regla: { tipo: 'mensual', dia: 1 }, cuentaId: bbva });
  return { ...p, bbva, efectivo };
}

const entradaDe = (v: VectorE11) => ({
  nombre: 'Tanda de la oficina',
  aportacion: v.aportacion,
  participantes: v.participantes,
  turno: v.turno,
  regla: v.regla,
  inicio: v.inicio,
});

describe('Tandas (02 §18)', () => {
  it('la UI fija vive en textos.ts sin exclamaciones', () => {
    const ui = [TITULO_TANDAS, TEXTO_TANDAS_VACIO, PREGUNTA_YA_DISTE, PREGUNTA_HOY_COBRO, TEXTO_NO_ES_INGRESO].join(
      '\n',
    );
    expect(ui).not.toMatch(/[!¡]/);
  });

  it('Volver en la lista tiene pista TalkBack', () => {
    const p = preparar('2026-10-16');
    renderConSesion(p.ctx, <PantallaTandas alVolver={jest.fn()} alAbrirTanda={jest.fn()} />);
    expect(screen.getByTestId('tandas-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER);
    expect(screen.getByTestId('tandas-titulo')).toHaveProp('accessibilityRole', 'header');
  });

  it('sin tandas lo explica y deja crear una nueva', () => {
    const p = preparar('2026-10-16');
    renderConSesion(p.ctx, <PantallaTandas alVolver={jest.fn()} alAbrirTanda={jest.fn()} />);
    expect(screen.getByTestId('tandas-vacio')).toHaveTextContent(TEXTO_TANDAS_VACIO);
    expect(screen.getByTestId('tandas-nueva')).toBeTruthy();
    expect(screen.queryByTestId(/^tanda-/)).toBeNull();
  });

  it('CA-M8-03 · el formulario crea la tanda de E11-01 con su calendario y la ronda 4 como tu turno', () => {
    const v = vector<VectorE11>('E11-01');
    const esperado = v.esperado as RondaVector[];
    const p = preparar('2026-10-16');
    const alAbrirTanda = jest.fn();
    renderConSesion(p.ctx, <PantallaTandas alVolver={jest.fn()} alAbrirTanda={alAbrirTanda} />);

    fireEvent.press(screen.getByTestId('tandas-nueva'));
    fireEvent.changeText(screen.getByTestId('tanda-nombre'), EJEMPLO_NOMBRE_TANDA);
    fireEvent.changeText(screen.getByTestId('tanda-aportacion'), '500');
    fireEvent.press(screen.getByTestId('tanda-frecuencia-semanal'));
    fireEvent.changeText(screen.getByTestId('tanda-participantes'), '10');
    fireEvent.changeText(screen.getByTestId('tanda-turno'), '4');
    // La primera fecha llega prellenada con hoy (vie 16 oct).
    expect(screen.getByTestId('tanda-inicio').props.value).toBe('16/10/2026');
    expect(within(screen.getByTestId('tanda-resumen')).getByText(/Cobras \$5,000 el vie 6/)).toBeTruthy();
    expect(screen.queryByTestId('tanda-ya-empezo')).toBeNull();
    fireEvent.press(screen.getByTestId('tanda-guardar'));

    const [t] = listarTandas(p.ctx);
    if (!t) throw new Error('no se guardó la tanda');
    expect(alAbrirTanda).toHaveBeenCalledWith(t.id);
    const d = detalleTanda(p.ctx, t.id);
    expect(d.rondas.map((r) => r.fecha)).toEqual(esperado.map((r) => r.fecha));
    expect(d.rondas.filter((r) => r.esCobro).map((r) => r.t)).toEqual([4]);
  });

  it('CA-M8-05 · el detalle muestra el dinero en riesgo de E11-01 después de cada ronda', () => {
    const v = vector<VectorE11>('E11-01');
    const esperado = v.esperado as RondaVector[];
    const p = preparar('2026-10-16');
    const { tandaId } = crearTanda(p.ctx, { ...entradaDe(v), cuentaId: p.bbva });
    let vista = renderConSesion(p.ctx, <PantallaTanda tandaId={tandaId} alVolver={jest.fn()} />);

    // Calendario: tu ronda marcada y lo que arriesgas después de cada una (E11-01 `en_riesgo`).
    expect(screen.getByText(textoLineaRonda(4, 'vie 6', true))).toBeTruthy();
    for (const r of esperado) {
      expect(textoDe(`tanda-ronda-${r.t}-riesgo`)).toBe(textoDespuesRondaRiesgo(r.en_riesgo));
    }
    expect(textoDe('tanda-en-riesgo')).toBe(textoEnRiesgo(0));

    // Lo mostrado arriba sigue a lo registrado: ronda por ronda, con el cobro en tu turno.
    for (const r of esperado) {
      p.reloj.fijar(r.fecha);
      aportarTanda(p.ctx, { tandaId, fecha: r.fecha });
      if (r.t === v.turno) cobrarTanda(p.ctx, { tandaId, cuentaId: p.bbva });
      vista.unmount();
      vista = renderConSesion(p.ctx, <PantallaTanda tandaId={tandaId} alVolver={jest.fn()} />);
      expect(textoDe('tanda-en-riesgo')).toBe(textoEnRiesgo(r.en_riesgo));
      expect(textoDe('tanda-aportado')).toBe(textoAportado(r.aportado));
      if (r.t >= v.turno) {
        expect(textoDe('tanda-por-aportar')).toBe(textoPorAportar(r.por_aportar));
      }
    }
  });

  it('CA-M8-04 · Hoy pregunta "¿Ya diste tu tanda?"; "Ya la di" pide la cuenta y cubre la ronda', () => {
    const v = vector<VectorE11>('E11-01');
    const p = preparar('2026-10-16');
    const { programadoId } = crearTanda(p.ctx, entradaDe(v));
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);

    const tarjeta = screen.getByTestId('tarjeta-accion-0');
    expect(within(tarjeta).getByText(PREGUNTA_YA_DISTE)).toBeTruthy();
    fireEvent.press(within(tarjeta).getByTestId('tarjeta-accion-0-ya-la-di'));
    fireEvent.press(screen.getByTestId(`tarjeta-accion-0-cuenta-${p.efectivo}`));
    expect(
      within(screen.getByTestId('aviso')).getByText(
        mensajeAportacion({ monto: 50_000, cuenta: 'Cartera' } as never),
        { hidden: true },
      ),
    ).toBeTruthy();
    const ronda = listarOcurrencias(p.ctx, { programadoId }).find((o) => o.fecha === '2026-10-16');
    expect(ronda?.estado).toBe('cubierta');
    expect(screen.queryByText(PREGUNTA_YA_DISTE)).toBeNull();
  });

  it('CA-M8-04 · en tu turno, "Me tocó la tanda" registra el cobro y avisa que no es ingreso', () => {
    const v = vector<VectorE11>('E11-01');
    const p = preparar('2026-11-06');
    const { tandaId, cuentaId } = crearTanda(p.ctx, {
      ...entradaDe(v),
      aportacionesHechas: 4,
      yaCobraste: false,
    });
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    const cobro = screen.getAllByText(PREGUNTA_HOY_COBRO);
    expect(cobro).toHaveLength(1);
    const testID = screen
      .getAllByTestId(/^tarjeta-accion-\d$/)
      .find((n) => within(n).queryByText(PREGUNTA_HOY_COBRO))?.props.testID as string;
    fireEvent.press(screen.getByTestId(`${testID}-me-toco`));
    fireEvent.press(screen.getByTestId(`${testID}-me-toco-cuenta-${p.bbva}`));
    expect(
      within(screen.getByTestId('aviso')).getByText(
        mensajeCobro({ monto: 500_000, cuenta: 'BBVA' } as never),
        { hidden: true },
      ),
    ).toBeTruthy();
    expect(detalleTanda(p.ctx, tandaId).cobrada).toBe(true);
    expect(p.ctx.libro.saldo(cuentaId)).toBe(200_000 - 500_000);
  });

  it('CA-M8-06 · con la primera fecha pasada propone "Llevas 6 aportaciones y ya cobraste: te faltan 4 ($2,000)"', () => {
    const v = vector<VectorE11>('E11-03');
    const p = preparar(v.hoy as PlainDate);
    renderConSesion(p.ctx, <PantallaTandas alVolver={jest.fn()} alAbrirTanda={jest.fn()} nuevaAlInicio />);
    fireEvent.changeText(screen.getByTestId('tanda-aportacion'), '500');
    fireEvent.press(screen.getByTestId('tanda-frecuencia-semanal'));
    fireEvent.changeText(screen.getByTestId('tanda-participantes'), '10');
    fireEvent.changeText(screen.getByTestId('tanda-turno'), '4');
    fireEvent.changeText(screen.getByTestId('tanda-inicio'), '04/09/2026');
    expect(textoDe('tanda-ya-empezo-texto')).toBe(
      textoYaEmpezoCompleto({
        aportacionesHechas: 6,
        yaCobraste: true,
        saldoInicial: -200_000,
        faltan: 4,
        porAportar: 200_000,
      }),
    );
    expect(screen.getByTestId('tanda-hechas').props.value).toBe('6');
    fireEvent.press(screen.getByTestId('tanda-guardar'));
    const [t] = listarTandas(p.ctx);
    if (!t) throw new Error('no se guardó la tanda');
    expect(t).toMatchObject({ posicion: -200_000, cobrada: true, aportacionesHechas: 6 });
  });

  it('sin id válido explica que no la encontró', () => {
    const p = preparar('2026-10-16');
    renderConSesion(p.ctx, <PantallaTanda tandaId="tanda-inexistente" alVolver={jest.fn()} />);
    expect(screen.getByTestId('tanda-no-encontrada')).toHaveTextContent(TEXTO_TANDA_NO_ENCONTRADA);
  });

  it('editar y archivar desde el detalle: cambia nombre y cuenta y quita la tanda de la lista', () => {
    const v = vector<VectorE11>('E11-01');
    const p = preparar('2026-10-16');
    const { tandaId } = crearTanda(p.ctx, { ...entradaDe(v), cuentaId: p.bbva });
    const alVolver = jest.fn();
    const vista = renderConSesion(p.ctx, <PantallaTanda tandaId={tandaId} alVolver={alVolver} />);

    fireEvent.press(screen.getByTestId('tanda-editar-abrir'));
    fireEvent.changeText(screen.getByTestId('tanda-editar-nombre'), 'Tanda vecinos');
    fireEvent.press(screen.getByTestId(`tanda-editar-cuenta-${p.efectivo}`));
    fireEvent.press(screen.getByTestId('tanda-editar-guardar'));
    expect(detalleTanda(p.ctx, tandaId).nombre).toBe('Tanda vecinos');
    expect(detalleTanda(p.ctx, tandaId).cuentaOrigenId).toBe(p.efectivo);

    fireEvent.press(screen.getByTestId('tanda-archivar-abrir'));
    fireEvent.press(screen.getByTestId('tanda-archivar-confirmar'));
    expect(listarTandas(p.ctx)).toEqual([]);
    expect(alVolver).toHaveBeenCalled();
    vista.unmount();

    renderConSesion(p.ctx, <PantallaTanda tandaId={tandaId} alVolver={jest.fn()} />);
    expect(screen.getByTestId('tanda-archivada')).toBeTruthy();
    expect(screen.queryByTestId('tanda-ya-la-di')).toBeNull();
  });

  it('TK01 · la frase dictada abre el formulario prellenado y "Guardar tanda" la crea', async () => {
    const p = preparar('2026-10-11');
    const caso = golden('TK01');
    const f = nubeFalsa({ [caso.texto]: caso.esperado });
    renderConSesion(
      p.ctx,
      <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />,
      f.nube,
    );
    fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.changeText(screen.getByTestId('campo-registrar'), caso.texto);
    await act(async () => {
      fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    });
    const tarjeta = screen.getByTestId('tanda-por-crear');
    expect(within(tarjeta).getByTestId('tanda-participantes').props.value).toBe('10');
    expect(within(tarjeta).getByTestId('tanda-turno').props.value).toBe('4');
    expect(within(tarjeta).getByTestId('tanda-inicio').props.value).toBe('15/10/2026');
    expect(listarTandas(p.ctx)).toEqual([]);
    fireEvent.press(within(tarjeta).getByTestId('tanda-guardar'));
    const [t] = listarTandas(p.ctx);
    expect(t).toMatchObject({ aportacion: 50_000, participantes: 10, turno: 4 });
    expect(screen.getByTestId('aviso')).toHaveTextContent(MENSAJE_TANDA_GUARDADA);
  });
});

describe('copy centralizado (textos.ts)', () => {
  it('formulario y tarjetas de Hoy usan los mismos mensajes de Todavía no', () => {
    expect(MENSAJE_TODAVIA_NO_APORTACION).toBe('La sigo apartando. Te pregunto mañana.');
    expect(MENSAJE_TODAVIA_NO_COBRO).toBe('Va. Te pregunto mañana.');
    expect(ETIQUETA_GUARDAR_TANDA).toBe('Guardar tanda');
  });
});
