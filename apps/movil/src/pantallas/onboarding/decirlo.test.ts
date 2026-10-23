import { describe, expect, it } from 'vitest';
import type { LecturaDe, LecturaPaso } from '@cartera/nlu';
import { PAGOS_FIJOS_SUGERIDOS } from '../../servicios/onboarding';
import {
  combinarLecturas,
  dejarTarjetaDicha,
  efectoCuentas,
  entradasCuentas,
  entradaTarjeta,
  faltantesIngreso,
  faltantesPagos,
  filasCuentas,
  filasIngreso,
  filasPagos,
  filasTarjeta,
  huecosIngreso,
  huecosTarjeta,
  ingresoConLectura,
  nombresCuentas,
  pendientesTarjeta,
  planCuentas,
  planPagos,
  prellenadoTarjeta,
  reglaDeEstadoIngreso,
  resumenEntendi,
  tomarTarjetaDicha,
  type EstadoIngreso,
} from './decirlo';
import {
  btnSiAgrega,
  numeroPasoOnboarding,
  pasosVisiblesOnboarding,
  pistaConfirmarVoz,
  progresoOnboardingBp,
  textoAgregue,
  textoMeFalta,
  textoNoEntendido,
  textoProgresoOnboarding,
  tituloEntendiAgrego,
} from './textos';

const cifra = (monto: number, aproximado = false) => ({ monto, aproximado });

/** O3 recién abierto: quincena y «antes» por omisión, nada escrito. */
const VACIO: EstadoIngreso = {
  frecuencia: 'quincena',
  finDeSemana: 'antes',
  diaSemana: null,
  ancla: null,
  diaMes: null,
  monto: null,
  aproximado: false,
  reglaDicha: null,
};

describe('O3 · lo dicho encima del formulario', () => {
  it('«gano 13 mil cada quincena» queda completo: regla del 15 y último con el fin de semana del formulario', () => {
    const e = ingresoConLectura(VACIO, {
      paso: 'ingreso',
      monto: cifra(1_300_000),
      frecuencia: 'quincena',
      regla: { tipo: 'quincenal_15_ultimo' },
    });
    expect(huecosIngreso(e)).toEqual([]);
    expect(e.monto).toBe(1_300_000);
    expect(reglaDeEstadoIngreso(e)).toEqual({ tipo: 'quincenal_15_ultimo', ajuste: 'anterior' });
  });

  it('«me pagan 8 mil cada viernes» pone el día; «si cae en fin de semana me pagan después» cambia el ajuste', () => {
    const e = ingresoConLectura(VACIO, {
      paso: 'ingreso',
      monto: cifra(800_000),
      frecuencia: 'semanal',
      regla: { tipo: 'semanal', dia_semana: 5 },
      finDeSemana: 'despues',
    });
    expect(e).toMatchObject({ frecuencia: 'semanal', diaSemana: 5, finDeSemana: 'despues' });
    expect(reglaDeEstadoIngreso(e)).toEqual({ tipo: 'semanal', dia_semana: 5, ajuste: 'siguiente' });
  });

  it('solo la cifra deja la frecuencia y el día que ya estaban; otra frecuencia borra el día viejo', () => {
    const mensual: EstadoIngreso = { ...VACIO, frecuencia: 'mensual', diaMes: 30, monto: 900_000 };
    expect(ingresoConLectura(mensual, { paso: 'ingreso', monto: cifra(1_200_000) })).toMatchObject({
      frecuencia: 'mensual',
      diaMes: 30,
      monto: 1_200_000,
    });
    const semanal = ingresoConLectura(mensual, { paso: 'ingreso', frecuencia: 'semanal' });
    expect(semanal).toMatchObject({ frecuencia: 'semanal', diaSemana: null, diaMes: null, monto: 900_000 });
    expect(huecosIngreso(semanal)).toEqual(['dia_semana']);
  });

  it('lo que falta va en el orden del formulario y «Varía» no pide nada', () => {
    const e = ingresoConLectura(VACIO, { paso: 'ingreso', frecuencia: 'semanal' });
    expect(huecosIngreso(e)).toEqual(['dia_semana', 'monto']);
    expect(textoMeFalta(faltantesIngreso(e))).toBe('Me falta saber qué día te pagan y cuánto te pagan.');
    expect(huecosIngreso({ ...VACIO, frecuencia: 'varia' })).toEqual([]);
  });

  it('una quincena de otros días («los días 10 y 25») se guarda tal cual con su ajuste', () => {
    const e = ingresoConLectura(VACIO, {
      paso: 'ingreso',
      monto: cifra(700_000),
      frecuencia: 'quincena',
      regla: { tipo: 'quincenal_dias', dias: [10, 25] },
    });
    expect(reglaDeEstadoIngreso(e)).toEqual({ tipo: 'quincenal_dias', dias: [10, 25], ajuste: 'anterior' });
  });

  it('filas: cada cuándo, próximo pago y fin de semana; si falta algo, la fila dice «Falta»', () => {
    const completo = ingresoConLectura(VACIO, { paso: 'ingreso', monto: cifra(1_300_000) });
    expect(filasIngreso(completo, '2026-10-15', 'Antes').map((f) => [f.clave, f.valor])).toEqual([
      ['frecuencia', 'Cada quincena (15 y último)'],
      ['proximo', 'jue 15'],
      ['fin_de_semana', 'Antes'],
    ]);
    const incompleto = ingresoConLectura(VACIO, { paso: 'ingreso', frecuencia: 'mensual' });
    expect(filasIngreso(incompleto, null, 'Antes').map((f) => [f.clave, f.valor])).toEqual([
      ['frecuencia', 'Cada mes'],
      ['dia_mes', 'Falta'],
      ['monto', 'Falta'],
      ['fin_de_semana', 'Antes'],
    ]);
  });
});

describe('correcciones dichas sobre la tarjeta «Entendí»', () => {
  it('ingreso: «no, son 12 mil» cambia la cifra y se queda la quincena', () => {
    const antes: LecturaPaso = {
      paso: 'ingreso',
      monto: cifra(1_300_000, true),
      frecuencia: 'quincena',
      regla: { tipo: 'quincenal_15_ultimo' },
    };
    expect(combinarLecturas(antes, { paso: 'ingreso', monto: cifra(1_200_000) })).toEqual({
      ...antes,
      monto: cifra(1_200_000),
    });
    // Otra frecuencia sin día: la regla vieja sobra.
    expect(combinarLecturas(antes, { paso: 'ingreso', frecuencia: 'semanal' })).toEqual({
      paso: 'ingreso',
      monto: cifra(1_300_000, true),
      frecuencia: 'semanal',
    });
  });

  it('cuentas: la misma institución se reemplaza, una nueva se agrega y el efectivo se queda', () => {
    const antes: LecturaPaso = {
      paso: 'cuentas',
      efectivo: cifra(50_000),
      cuentas: [{ nombre: 'BBVA', institucion: 'bbva_mx', subtipo: 'debito', saldo: cifra(300_000) }],
    };
    const nueva: LecturaPaso = {
      paso: 'cuentas',
      cuentas: [
        { nombre: 'BBVA', institucion: 'bbva_mx', subtipo: 'debito', saldo: cifra(400_000) },
        { nombre: 'Spin by OXXO', institucion: 'spin_oxxo', subtipo: 'billetera', saldo: cifra(20_000) },
      ],
    };
    expect(combinarLecturas(antes, nueva)).toEqual({ ...antes, cuentas: nueva.cuentas });
  });

  it('pagos: «la renta son 5 mil» cambia el monto y se queda el día', () => {
    const antes: LecturaPaso = {
      paso: 'pagos_fijos',
      pagos: [
        {
          concepto: 'Renta',
          monto: cifra(450_000),
          frecuencia: 'mensual',
          regla: { tipo: 'mensual', dia: 5 },
        },
      ],
    };
    expect(
      combinarLecturas(antes, { paso: 'pagos_fijos', pagos: [{ concepto: 'Renta', monto: cifra(500_000) }] }),
    ).toEqual({
      paso: 'pagos_fijos',
      pagos: [
        {
          concepto: 'Renta',
          monto: cifra(500_000),
          frecuencia: 'mensual',
          regla: { tipo: 'mensual', dia: 5 },
        },
      ],
    });
  });

  it('tarjeta: días para pagar reemplaza al día límite; otro paso es una lectura nueva', () => {
    const antes: LecturaPaso = { paso: 'tarjeta', nombre: 'Nu', diaCorte: 28, diaLimitePago: 18 };
    expect(combinarLecturas(antes, { paso: 'tarjeta', diasParaPagar: 20 })).toEqual({
      paso: 'tarjeta',
      nombre: 'Nu',
      diaCorte: 28,
      diasParaPagar: 20,
    });
    const colchon: LecturaPaso = { paso: 'colchon', monto: cifra(0) };
    expect(combinarLecturas(antes, colchon)).toBe(colchon);
  });
});

describe('O4 · cuentas dichas', () => {
  const dicho: LecturaDe<'cuentas'> = {
    paso: 'cuentas',
    efectivo: cifra(50_000),
    cuentas: [{ nombre: 'BBVA', institucion: 'bbva_mx', subtipo: 'debito', saldo: cifra(300_000) }],
  };

  it('lista vacía: agrega efectivo y BBVA con su institución', () => {
    const plan = planCuentas(dicho, []);
    expect(filasCuentas(plan).map((f) => [f.etiqueta, f.valor])).toEqual([
      ['Efectivo', '$500'],
      ['BBVA · Débito', '$3,000'],
    ]);
    expect(entradasCuentas(plan)).toEqual({
      efectivo: 50_000,
      cuentas: [{ subtipo: 'debito', nombre: 'BBVA', saldo: 300_000, institucion: 'bbva_mx' }],
    });
    expect(textoAgregue(nombresCuentas(plan))).toBe('Listo: agregué BBVA y tu efectivo.');
    expect(efectoCuentas(plan)).toBeNull();
  });

  it('lo que ya está no se agrega dos veces y se dice', () => {
    const plan = planCuentas(dicho, [
      { nombre: 'Efectivo', subtipo: 'efectivo' },
      { nombre: 'bbva', subtipo: 'debito' },
    ]);
    expect(plan.nuevas).toEqual([]);
    expect(plan.efectivo).toBeNull();
    expect(efectoCuentas(plan)).toBe(
      'BBVA ya está en tu lista: no la agrego otra vez. Tu efectivo ya está anotado: si cambió, ajústalo en Cuentas.',
    );
  });
});

describe('O4 · tarjeta dicha (02 §3.1)', () => {
  const nu: LecturaDe<'tarjeta'> = { paso: 'tarjeta', nombre: 'Nu', diaCorte: 28, diaLimitePago: 18 };
  const completa: LecturaDe<'tarjeta'> = {
    ...nu,
    limiteCredito: cifra(3_000_000),
    saldo: cifra(800_000),
    modo: 'totalero',
  };

  it('sin límite, saldo ni modo no se crea: dice qué falta y prellena el ciclo', () => {
    expect(huecosTarjeta(nu)).toEqual(['limite_credito', 'modo', 'saldo']);
    expect(entradaTarjeta(nu)).toBeNull();
    expect(prellenadoTarjeta(nu)).toEqual({
      alias: 'Nu',
      diaCorte: 28,
      diaLimitePago: 18,
      diasParaPagar: null,
      nombre: 'Nu',
      ultimos4: null,
      saldo: null,
      modo: null,
      limiteCredito: null,
    });
    expect(filasTarjeta(nu).map((f) => [f.clave, f.valor])).toEqual([
      ['nombre', 'Nu'],
      ['corte', 'El 28'],
      ['limite_pago', 'El 18'],
    ]);
  });

  it('completa se crea sin formulario; con meses que ya tenías siempre pasa por el formulario', () => {
    expect(entradaTarjeta(completa)).toEqual({
      nombre: 'Nu',
      alias: ['Nu'],
      diaCorte: 28,
      diaLimitePago: 18,
      limiteCredito: 3_000_000,
      modo: 'totalero',
      saldo: 800_000,
    });
    const conMeses = { ...completa, msiPrevios: [{ mensualidad: 50_000, restantes: 6 }] };
    expect(huecosTarjeta(conMeses)).toEqual(['msi']);
    expect(entradaTarjeta(conMeses)).toBeNull();
  });

  it('todo lo dicho llega al formulario y solo se pide lo que falta; la tarjeta llega a su pantalla una sola vez', () => {
    const conSaldo = { ...nu, ultimos4: '4410', saldo: cifra(800_000), modo: 'plan' as const };
    expect(prellenadoTarjeta(conSaldo)).toMatchObject({
      nombre: 'Nu',
      ultimos4: '4410',
      saldo: 800_000,
      modo: 'plan',
      limiteCredito: null,
    });
    expect(pendientesTarjeta(conSaldo)).toEqual(['tu límite de crédito']);
    expect(pendientesTarjeta(completa)).toEqual([]);
    dejarTarjetaDicha(nu);
    expect(tomarTarjetaDicha()).toBe(nu);
    expect(tomarTarjetaDicha()).toBeNull();
  });
});

describe('O5 · pagos dichos', () => {
  it('la renta del catálogo se guarda como «renta» con su categoría; a Netflix le falta el día', () => {
    const plan = planPagos(
      [
        {
          concepto: 'Renta',
          monto: cifra(450_000),
          frecuencia: 'mensual',
          regla: { tipo: 'mensual', dia: 5 },
        },
        { concepto: 'Netflix', monto: cifra(21_900), frecuencia: 'mensual' },
      ],
      PAGOS_FIJOS_SUGERIDOS,
    );
    expect(plan[0]).toMatchObject({
      concepto: 'Renta',
      conceptoGuardado: 'renta',
      categoria: 'vivienda',
      regla: { tipo: 'mensual', dia: 5 },
      huecos: [],
    });
    expect(plan[1]).toMatchObject({
      concepto: 'Netflix',
      conceptoGuardado: 'Netflix',
      regla: null,
      huecos: ['dia'],
    });
    expect(filasPagos(plan).map((f) => [f.etiqueta, f.valor])).toEqual([
      ['Renta · día 5 de cada mes', '$4,500'],
      ['Netflix · falta el día', '$219'],
    ]);
    expect(textoMeFalta(faltantesPagos(plan))).toBe('Me falta saber qué día pagas Netflix.');
  });

  it('la cuenta dicha se busca entre las de salida y lo dicho va al formulario como en Cuentas', () => {
    const [renta] = planPagos(
      [
        {
          concepto: 'Renta',
          monto: cifra(450_000),
          frecuencia: 'mensual',
          regla: { tipo: 'mensual', dia: 5 },
          cuentaAlias: 'bbva',
          pagosRestantes: 12,
        },
      ],
      PAGOS_FIJOS_SUGERIDOS,
      [{ id: 'cta-1', nombre: 'BBVA' }],
    );
    expect(renta).toMatchObject({ cuentaId: 'cta-1', pagosRestantes: 12 });
    expect(renta?.prellenado).toMatchObject({
      clave: 'renta',
      nombre: 'Renta',
      monto: 450_000,
      cuentaId: 'cta-1',
      respuestas: { frecuencia: 'mensual', diaMes: '5', pagosRestantes: '12' },
    });
  });

  it('quincena sin día es del 15 y último; cada dos meses, anual sin fecha y semanal sin día piden lo suyo', () => {
    const plan = planPagos(
      [
        { concepto: 'Tanda', monto: cifra(50_000), frecuencia: 'quincenal' },
        { concepto: 'Luz', monto: cifra(40_000, true), avisos: ['cada_dos_meses'] },
        { concepto: 'Seguro', monto: cifra(980_000), frecuencia: 'anual' },
        { concepto: 'Clases', monto: cifra(30_000), frecuencia: 'semanal' },
      ],
      PAGOS_FIJOS_SUGERIDOS,
    );
    expect(plan.map((p) => [p.regla?.tipo ?? null, p.huecos])).toEqual([
      ['quincenal_15_ultimo', []],
      [null, ['frecuencia']],
      [null, ['mes', 'dia']],
      [null, ['dia_semana']],
    ]);
    expect(plan[1]).toMatchObject({ variable: true, categoria: 'servicios', aproximado: true });
  });
});

describe('tarjeta «Entendí» y textos del paso dicho', () => {
  it('el resumen para el lector junta título, cifra, filas y efecto', () => {
    expect(
      resumenEntendi({
        titulo: 'Entendí',
        monto: 1_300_000,
        filas: [{ clave: 'frecuencia', etiqueta: 'Cada cuándo', valor: 'Cada quincena (15 y último)' }],
        efecto: 'Es una cifra aproximada: corrígela si sabes la exacta.',
        confirmar: { etiqueta: 'Sí, así es', accion: () => {} },
      }),
    ).toBe(
      'Entendí. $13,000. Cada cuándo: Cada quincena (15 y último). Es una cifra aproximada: corrígela si sabes la exacta.',
    );
  });

  it('títulos y botones concuerdan en número y género; sin exclamaciones', () => {
    expect(tituloEntendiAgrego(1, 'f')).toBe('Entendí · ¿la agrego?');
    expect(tituloEntendiAgrego(2, 'f')).toBe('Entendí · ¿las agrego?');
    expect(tituloEntendiAgrego(3, 'm')).toBe('Entendí · ¿los agrego?');
    expect([btnSiAgrega(1, 'f'), btnSiAgrega(2, 'm')]).toEqual(['Sí, agrégala', 'Sí, agrégalos']);
    for (const t of [textoNoEntendido('hola'), pistaConfirmarVoz('no, son 12 mil'), textoAgregue(['BBVA'])]) {
      expect(t).not.toMatch(/[!¡]/);
    }
  });
});

describe('progreso del onboarding (iPhone de 6, Android de 7)', () => {
  it('en iPhone el colchón es el paso 6 de 6 y la barra llega al final', () => {
    const total = pasosVisiblesOnboarding(true);
    expect(total).toBe(6);
    expect(textoProgresoOnboarding(numeroPasoOnboarding(7, true), total)).toBe('Paso 6 de 6');
    expect(progresoOnboardingBp(numeroPasoOnboarding(7, true), total)).toBe(10_000);
    expect(textoProgresoOnboarding(numeroPasoOnboarding(5, true), total)).toBe('Paso 5 de 6');
  });

  it('en Android siguen siendo 7 y la barra avanza n/7', () => {
    expect(pasosVisiblesOnboarding(false)).toBe(7);
    expect(numeroPasoOnboarding(7, false)).toBe(7);
    expect(progresoOnboardingBp(3, 7)).toBe(4_286);
    expect(progresoOnboardingBp(0, 0)).toBe(0);
  });
});
