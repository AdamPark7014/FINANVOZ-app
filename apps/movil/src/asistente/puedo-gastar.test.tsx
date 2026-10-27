import { aceptarConsentimiento, agregarCuenta, obtenerHoy, type VistaMeAlcanza } from '../servicios';
import { abrirPruebaPantalla, conEscenario } from '../pantallas/principal/__pruebas__/base';
import { TEXTO_PUEDO_SIN_INGRESO } from '../pantallas/asistente/textos';
import type { TurnoConversacion } from './conversacion';
import {
  leerPuedoGastar,
  montoDicho,
  simularCompraHoy,
  turnoPuedoGastar,
  turnosPuedoGastar,
} from './puedo-gastar';
import type { Turno } from './tipos';

function falsas() {
  let n = 0;
  const agregados: TurnoConversacion[] = [];
  return {
    agregados,
    o: {
      nuevoId: (p: string) => `${p}-${++n}`,
      abrirR2: jest.fn(),
      abrirMeAlcanza: jest.fn(),
      abrirIngreso: jest.fn(),
      mostrar: jest.fn(),
      reemplazar: jest.fn(),
      agregar: jest.fn((...t: TurnoConversacion[]) => {
        agregados.push(...t);
      }),
    },
  };
}

describe('asistente/puedo-gastar · leer la pregunta en el teléfono (cero tokens)', () => {
  it.each([
    ['puedo gastar 500 en unos tenis', { precio: 50_000, descripcion: 'unos tenis' }],
    ['¿Puedo gastar $1,500 en unos tenis?', { precio: 150_000, descripcion: 'unos tenis' }],
    ['¿me alcanza para el cine?', { precio: null, descripcion: 'el cine' }],
    ['¿puedo comprarme unos tenis de 1,500?', { precio: 150_000, descripcion: 'unos tenis' }],
    ['puedo gastar quinientos en comida', { precio: 50_000, descripcion: 'comida' }],
    ['¿podría gastar 5 mil?', { precio: 500_000, descripcion: null }],
    ['¿me da para una pizza de 200?', { precio: 20_000, descripcion: 'una pizza' }],
  ])('«%s»', (frase, esperado) => {
    expect(leerPuedoGastar(frase)).toEqual(esperado);
  });

  it('lo que no es pregunta de gasto no se toma', () => {
    expect(leerPuedoGastar('tacos 80 en efectivo')).toBeNull();
    expect(leerPuedoGastar('¿cuánto llevo en antojos?')).toBeNull();
    expect(leerPuedoGastar('')).toBeNull();
  });

  it('montoDicho: escrito, con «pesos» o dicho en palabras; cero o texto no son cifra', () => {
    expect(montoDicho('$1,500')).toBe(150_000);
    expect(montoDicho('300 pesos')).toBe(30_000);
    expect(montoDicho('dos mil')).toBe(200_000);
    expect(montoDicho('0')).toBeNull();
    expect(montoDicho('unos tenis')).toBeNull();
  });
});

describe('asistente/puedo-gastar · cómo queda tu día (E4 de core)', () => {
  it('con la semilla e4-01: $100 deja el día en $189; $1,500 deja un faltante de $644', () => {
    const p = conEscenario('e4-01');
    const vista = obtenerHoy(p.ctx);
    expect(vista.hoyPuedesPesos).toBe(214);
    expect(simularCompraHoy(vista, 10_000)).toEqual({
      hoyPuedes: 18_900,
      libre: 75_600,
      faltante: 0,
      dias: 4,
    });
    expect(simularCompraHoy(vista, 150_000)).toEqual({
      hoyPuedes: 0,
      libre: -64_400,
      faltante: 64_400,
      dias: 4,
    });
    p.cerrar();
  });

  it('sin descripción dice «Si gastas…»; trae lo que pinta la tarjeta de B3, todo de E4', () => {
    const p = conEscenario('e4-01');
    const { o } = falsas();
    const t = turnoPuedoGastar(p.ctx, { precio: 30_000 }, o, 'x') as Extract<Turno, { clase: 'aviso' }>;
    expect(t.texto).toBe('Te alcanza. Si gastas $300 hoy, tu día pasa de $214 a $139 hasta el jue 15.');
    expect(t.detalle).toBeUndefined();
    expect(t.acciones.map((a) => a.etiqueta)).toEqual(['Lo compré']);
    const vista = obtenerHoy(p.ctx);
    expect(t.puedoGastar).toMatchObject({
      precio: 30_000,
      que: null,
      antes: vista.hoyPuedesCentavos,
      despues: 13_900,
      libreDespues: vista.libre - 30_000,
      faltante: 0,
      dias: 4,
      proximo: { concepto: 'quincena', etiqueta: 'jue 15', fecha: '2026-10-15' },
      tienes: { monto: vista.liquidez },
      reservado: { monto: vista.reservado, nombres: vista.reservadoDetalle.map((r) => r.concepto) },
      colchon: vista.colchon,
    });
    p.cerrar();
  });

  it('sin ingreso pide configurarlo (no hay día que calcular)', () => {
    const p = abrirPruebaPantalla();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 300_000 });
    const { o } = falsas();
    const t = turnoPuedoGastar(p.ctx, { precio: 30_000 }, o, 'x') as Extract<Turno, { clase: 'aviso' }>;
    expect(t.texto).toBe(TEXTO_PUEDO_SIN_INGRESO);
    void t.acciones[0]?.accion();
    expect(o.abrirIngreso).toHaveBeenCalled();
    p.cerrar();
  });

  it('con las opciones de Plus: una línea por opción (sin «sin comprar») y «Ver opciones»', () => {
    const p = conEscenario('e4-01');
    const { o } = falsas();
    const opciones = {
      estado: 'ok',
      escenarios: [
        { tipo: 'contado_hoy', etiqueta: 'Hoy, de contado', porcentaje: '72 %' },
        { tipo: 'esperar', etiqueta: 'El jue 15, con tu quincena', porcentaje: '95 %' },
        { tipo: 'base', etiqueta: 'Sin comprarlos', porcentaje: '97 %' },
      ],
    } as unknown as VistaMeAlcanza;
    const consulta = { precio: 50_000, descripcion: 'unos tenis' };
    const t = turnoPuedoGastar(p.ctx, consulta, o, 'x', opciones) as Extract<Turno, { clase: 'aviso' }>;
    expect(t.detalle).toBe(
      'Hoy, de contado: 72 % de llegar sin tocar tu colchón.\nEl jue 15, con tu quincena: 95 % de llegar sin tocar tu colchón.',
    );
    expect(t.acciones.map((a) => a.etiqueta)).toEqual(['Lo compré', 'Ver opciones']);
    void t.acciones[1]?.accion();
    expect(o.abrirMeAlcanza).toHaveBeenCalledWith(consulta);
    p.cerrar();
  });

  it('sin la cifra pregunta «¿Cuánto cuesta?»; con la respuesta, tu turno y la cuenta del día', () => {
    const p = conEscenario('e4-01');
    const { o, agregados } = falsas();
    const [q] = turnosPuedoGastar(p.ctx, { precio: null, descripcion: 'el cine' }, o);
    const pregunta = q as Extract<Turno, { clase: 'pregunta' }>;
    expect(pregunta).toMatchObject({ texto: '¿Cuánto cuesta?', campo: 'monto' });
    pregunta.responder({ tipo: 'texto', texto: 'no sé', porVoz: true });
    expect(o.agregar).not.toHaveBeenCalled();
    pregunta.responder({ tipo: 'monto', centavos: 15_000, aproximado: false });
    expect(agregados[0]).toMatchObject({ de: 'persona', texto: '$150' });
    expect((agregados[1] as Extract<Turno, { clase: 'aviso' }>).texto).toBe(
      'Te alcanza. Si compras el cine de $150 hoy, tu día pasa de $214 a $176 hasta el jue 15.',
    );
    p.cerrar();
  });
});
