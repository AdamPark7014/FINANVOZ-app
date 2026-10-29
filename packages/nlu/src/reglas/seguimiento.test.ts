import { describe, expect, it } from 'vitest';
import { leerCharla } from '../charla';
import type { ContextoInterprete } from '../contexto';
import { Interpretacion } from '../esquema';
import { evaluarConversaciones } from '../eval/evaluar-conversaciones';
import { cargarContexto, cargarGoldenConversaciones } from '../eval/fixtures';
import { interpretarReglas } from './index';

const { contexto } = cargarContexto();

/** El turno anterior tal como lo guarda la app: lo dicho y lo que entendió el nivel 0. */
function tras(frase: string): ContextoInterprete {
  const interpretacion = interpretarReglas(frase, contexto);
  if (!interpretacion) throw new Error(`el nivel 0 no entendió «${frase}»`);
  return { ...contexto, anterior: { frase, interpretacion } };
}
const seguir = (anterior: string, frase: string) => interpretarReglas(frase, tras(anterior));

describe('golden de conversaciones (06 §15)', () => {
  it('el nivel 0 cubre todo lo marcado y nunca responde mal', () => {
    const r = evaluarConversaciones(cargarGoldenConversaciones(), contexto);
    expect(r.turnos.filter((t) => t.marcadoReglas && !t.correcto).map((t) => t.id)).toEqual([]);
    expect(r.turnos.filter((t) => t.respondio && !t.correcto).map((t) => t.id)).toEqual([]);
    expect(r.aprobado).toBe(true);
  });

  it('todo esperado con interpretación valida contra el esquema', () => {
    for (const caso of cargarGoldenConversaciones()) {
      for (const turno of caso.turnos) {
        if (typeof turno.esperado.charla === 'string') continue;
        // Los `null` del esperado dicen «este campo no debe venir»; el esquema no los admite.
        const sinNulos = JSON.parse(JSON.stringify(turno.esperado, (_k, v: unknown) => v ?? undefined));
        expect(Interpretacion.safeParse(sinNulos).success, `${caso.id}: ${turno.texto}`).toBe(true);
      }
    }
  });
});

describe('seguimientos de una consulta', () => {
  it('otro periodo u otra categoría, con la misma consulta', () => {
    expect(seguir('¿cuánto gasté en súper este mes?', '¿y antier?')).toEqual({
      intencion: 'consultar',
      consulta: { tipo: 'gasto_por_categoria', desde: '2026-10-09', hasta: '2026-10-09', categoria: 'super' },
    });
    expect(seguir('¿en qué se me va el dinero?', '¿y de antojos?')).toEqual({
      intencion: 'consultar',
      consulta: {
        tipo: 'gasto_por_categoria',
        desde: '2026-09-12',
        hasta: '2026-10-11',
        categoria: 'antojos',
      },
    });
    expect(seguir('¿cuánto gasté hoy?', '¿y cuánto en comida el mes pasado?')).toEqual({
      intencion: 'consultar',
      consulta: {
        tipo: 'gasto_por_categoria',
        desde: '2026-09-01',
        hasta: '2026-09-30',
        categoria: 'comida',
      },
    });
  });

  it('lo que no tiene sentido para esa consulta no se adivina', () => {
    for (const [antes, frase] of [
      ['¿cuánto gasté hoy?', '¿y en la Nu?'],
      ['¿cuánto gasté hoy?', '¿y mañana?'],
      ['¿cuánto gasté hoy?', '¿por qué?'],
      ['¿cuánto gasté hoy?', '¿y en efectivo?'],
      ['¿cuánto puedo gastar hoy?', '¿y mañana?'],
      ['¿quién me debe dinero?', '¿y doña Mari?'],
      ['¿quién me debe dinero?', '¿y la semana pasada?'],
      ['¿cuánto tengo en BBVA?', '¿y ayer?'],
    ] as const) {
      expect(seguir(antes, frase), `${antes} → ${frase}`).toBeNull();
    }
  });

  it('«¿por qué?» tras «hoy puedes» es el desglose de hoy', () => {
    expect(seguir('¿cuánto puedo gastar hoy?', '¿por qué?')).toEqual({
      intencion: 'consultar',
      consulta: { tipo: 'desglose_hoy' },
    });
  });

  it('una frase completa gana al seguimiento', () => {
    expect(seguir('¿cuánto gasté hoy?', 'uber 120')?.intencion).toBe('registrar');
    expect(seguir('coca 25', '¿cuánto llevo en antojos?')?.intencion).toBe('consultar');
  });
});

describe('seguimientos de un registro', () => {
  it('quitarle o sumarle a la cifra lo calcula el teléfono, y nunca deja la cifra en cero o negativa', () => {
    expect(seguir('coca 25', 'eran 10 más')).toEqual({
      intencion: 'corregir',
      objetivo: { ultimo: true },
      cambios: { monto: 3500 },
    });
    expect(seguir('coca 25', 'quítale 100')).toBeNull();
    expect(seguir('coca 25', 'quítale 25')).toBeNull();
  });

  it('con dos movimientos, «otra igual», «quítale 10» y «otro de 30» no dicen cuál', () => {
    expect(seguir('coca 25 y tacos 80', 'otra igual')).toBeNull();
    expect(seguir('coca 25 y tacos 80', 'quítale 10')).toBeNull();
    expect(seguir('coca 25 y tacos 80', 'otro de 30')).toBeNull();
    expect(seguir('coca 25 y tacos 80', 'lo mismo')?.intencion).toBe('registrar');
  });

  it('cuenta y categoría solo donde aplican', () => {
    // Un ingreso no tiene «de dónde salió»; un préstamo no lleva categoría de gasto; «comida» es un grupo.
    expect(seguir('me cayó la quincena, 8 mil', 'con BBVA')).toBeNull();
    expect(seguir('le presté 500 a Juan', 'ponlo en antojos')).toBeNull();
    expect(seguir('coca 25', 'ponlo en comida')).toBeNull();
    expect(seguir('coca 25', 'con la azul')).toBeNull();
  });

  it('sin turno anterior, los fragmentos no se adivinan', () => {
    for (const frase of [
      'otra igual',
      'no, en efectivo',
      'bórralo',
      'quítale 10',
      'fue ayer',
      'con BBVA',
      '¿y ayer?',
    ]) {
      expect(interpretarReglas(frase, contexto), frase).toBeNull();
    }
    expect(seguir('coca 25', 'no')).toBeNull();
    expect(seguir('coca 25', 'ayer')).toBeNull();
    expect(seguir('coca 25', 'mejor no')).toBeNull();
  });

  it('«y …» o «también …» con una frase completa, con o sin turno anterior', () => {
    expect(interpretarReglas('y spotify 129', contexto)?.intencion).toBe('registrar');
    expect(interpretarReglas('¿y cuánto debo?', contexto)).toEqual({
      intencion: 'consultar',
      consulta: { tipo: 'deuda_tarjetas' },
    });
    expect(interpretarReglas('y', contexto)).toBeNull();
  });
});

describe('seguimientos de «¿me alcanza?»', () => {
  it('otro día, sin meses o comprado', () => {
    expect(seguir('¿me alcanza para unos tenis de 1,200?', '¿y el viernes?')).toEqual({
      intencion: 'simular',
      compra: { precio: 120000, descripcion: 'unos tenis', fecha: '2026-10-16' },
    });
    expect(seguir('¿me alcanza para una laptop de 15,000 a 12 meses?', 'ya la compré con la Nu')).toEqual({
      intencion: 'registrar',
      movimientos: [
        {
          tipo: 'compra_msi',
          monto: 1500000,
          fecha: '2026-10-11',
          descripcion: 'laptop',
          categoria: 'tecnologia',
          origen: { tipo: 'credito', alias: 'nu' },
          msi: { meses: 12 },
        },
      ],
    });
    // A meses solo con crédito; «a meses» sin cuántos no se adivina.
    expect(
      seguir('¿me alcanza para una laptop de 15,000 a 12 meses?', 'ya la compré en efectivo'),
    ).toBeNull();
    expect(seguir('¿me alcanza para unos tenis de 1,200?', '¿y a meses?')).toBeNull();
    expect(seguir('¿me alcanza para unos tenis de 1,200?', '¿y de 1,200?')).toBeNull();
  });
});

describe('respuesta a una aclaración', () => {
  it('llega sola o pegada a la frase de antes (como la manda la app)', () => {
    const esperado = {
      intencion: 'simular',
      compra: { precio: 120000, descripcion: 'unos tenis' },
    };
    expect(seguir('¿me alcanza?', 'unos tenis de 1,200')).toEqual(esperado);
    expect(seguir('¿me alcanza?', '¿me alcanza?, unos tenis de 1,200')).toEqual(esperado);
    expect(seguir('¿me alcanza?', '1,500')).toEqual({ intencion: 'simular', compra: { precio: 150000 } });
  });

  it('el monto ambiguo solo con una de sus dos lecturas', () => {
    const antes = 'me salió en dos cincuenta el estacionamiento';
    const monto = (frase: string) => {
      const r = seguir(antes, frase);
      return r?.intencion === 'registrar' ? r.movimientos[0]?.monto : null;
    };
    expect(monto('$250')).toBe(25000);
    expect(monto('2.50')).toBe(250);
    expect(monto('fueron 250')).toBe(25000);
    expect(monto(`${antes}, $250`)).toBe(25000);
    expect(monto('300')).toBeNull();
  });

  it('«el domingo» de la semana pasada y «¿De cuándo?» con un periodo', () => {
    const r = seguir('la semana pasada me compré unos tenis de 1,200', 'el domingo');
    expect(r?.intencion === 'registrar' && r.movimientos[0]?.fecha).toBe('2026-10-04');
    expect(seguir('la semana pasada me compré unos tenis de 1,200', 'no sé')).toBeNull();
    expect(seguir('¿cuánto gasté?', '¿cuánto gasté?, el mes pasado')).toEqual({
      intencion: 'consultar',
      consulta: { tipo: 'gasto_total', desde: '2026-09-01', hasta: '2026-09-30' },
    });
  });

  it('otra cosa completa no se pega a la pregunta', () => {
    expect(seguir('me compré un café', 'uber 120')).toMatchObject({
      intencion: 'registrar',
      movimientos: [{ monto: 12000, categoria: 'transporte' }],
    });
    expect(seguir('me compré un café', '¿cuánto puedo gastar hoy?')?.intencion).toBe('consultar');
    expect(seguir('me compré un café', 'no, mejor no')).toBeNull();
  });
});

describe('consultas nuevas sin turno anterior', () => {
  const r = (frase: string) => interpretarReglas(frase, contexto);
  it('pagos que vienen, siempre hacia adelante', () => {
    expect(r('¿qué pagos tengo esta quincena?')).toEqual({
      intencion: 'consultar',
      consulta: { tipo: 'compromisos', desde: '2026-10-11', hasta: '2026-10-15' },
    });
    expect(r('¿qué tengo que pagar mañana?')).toEqual({
      intencion: 'consultar',
      consulta: { tipo: 'compromisos', desde: '2026-10-12', hasta: '2026-10-12' },
    });
    expect(r('¿qué pagos tengo el mes que viene?')).toEqual({
      intencion: 'consultar',
      consulta: { tipo: 'compromisos', desde: '2026-11-01', hasta: '2026-11-30' },
    });
    // Sin próximo ingreso, sin periodo son los próximos 7 días.
    const { proximo_ingreso: _p, ...sinIngreso } = contexto;
    void _p;
    expect(interpretarReglas('¿qué tengo que pagar?', sinIngreso)).toEqual({
      intencion: 'consultar',
      consulta: { tipo: 'compromisos', desde: '2026-10-11', hasta: '2026-10-17' },
    });
  });

  it('lo que debes en una tarjeta, no en una cuenta de débito ni a una persona', () => {
    expect(r('¿cuánto le debo a la Nu?')).toEqual({
      intencion: 'consultar',
      consulta: { tipo: 'saldo', alias: 'nu' },
    });
    expect(r('¿cuánto debo en BBVA?')).toBeNull();
    expect(r('¿cuánto le debo a Juan?')).toBeNull();
    expect(r('¿cuánto llevo?')).toBeNull();
  });
});

describe('charla', () => {
  it('cada tipo con sus frases y nada que el nivel 0 entienda', () => {
    expect(leerCharla('¡Adiós!')).toBe('despedida');
    expect(leerCharla('¿Mande?')).toBe('repetir');
    expect(leerCharla('¿Qué es el colchón?')).toBe('concepto_colchon');
    expect(leerCharla('ok')).toBe('afirmacion');
    expect(leerCharla('ok, tacos 80')).toBeNull();
    expect(leerCharla('no entendí nada de los 500')).toBeNull();
    for (const frase of [
      'ok',
      'adiós',
      '¿mande?',
      'no entendí',
      '¿qué es el colchón?',
      'no sirves',
      'listo, gracias',
    ]) {
      expect(interpretarReglas(frase, tras('coca 25')), frase).toBeNull();
    }
  });
});
