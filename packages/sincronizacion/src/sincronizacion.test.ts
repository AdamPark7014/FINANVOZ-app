import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ErrorDominio } from '@cartera/core';
import {
  aBase64Url,
  aadEvento,
  BYTES_NONCE,
  cifrarEvento,
  codificarQr,
  deBase64Url,
  descifrarFila,
  entradaBalance,
  eventosVigentes,
  fusionarEventos,
  leerQr,
  nuevaLlaveGrupo,
  saldoGrupo,
  serializarContenido,
  uuid4,
  type EventoCompartido,
  type FilaCifrada,
} from './index';
import { crearCriptoNoble } from './noble';

const FIXTURES = fileURLToPath(new URL('../../../fixtures', import.meta.url));
const aleatorio = (n: number) => new Uint8Array(randomBytes(n));
const cripto = crearCriptoNoble(aleatorio);
const hex = (s: string) => Uint8Array.from(Buffer.from(s, 'hex'));
const aHex = (b: Uint8Array) => Buffer.from(b).toString('hex');

const GRUPO = '7f3c1a52-8d4e-4b6a-9c21-0e5f7a8b9c0d';

// ── Vectores (cargados por id, nunca copiados) ─────────────────────────────────────────────────────────
const vectores = JSON.parse(readFileSync(`${FIXTURES}/motores/vectores.json`, 'utf8')) as {
  E12: { balance_pareja: VectorBalance[] };
};
const kat = JSON.parse(readFileSync(`${FIXTURES}/sincronizacion/kat.json`, 'utf8')) as {
  xchacha20poly1305: {
    id: string;
    llave_hex: string;
    nonce_hex: string;
    aad_hex: string;
    texto_utf8: string;
    cifrado_y_etiqueta_hex: string;
  }[];
  eventos: {
    id: string;
    llave_hex: string;
    nonce_hex: string;
    fila: { grupo_id: string; id: string; autor: 'a' | 'b' };
    contenido_utf8: string;
    aad_utf8: string;
    blob: string;
  }[];
};

type EventoVector =
  | { id: string; tipo?: 'gasto'; total: number; pago: 'a' | 'b'; proporcion_a_bp: number; anulado?: boolean }
  | { id: string; tipo: 'pago'; de: 'a' | 'b'; monto: number; anulado?: boolean };
interface VectorBalance {
  id: string;
  gastos: EventoVector[];
  esperado: { saldo: number; debe: 'a' | 'b' | null; monto: number };
}

/** Ids UUIDv4 deterministas a partir del id del vector ("g1" → …0001). */
function idDe(texto: string): string {
  const n = [...texto].reduce((s, c) => s * 31 + c.charCodeAt(0), 7) % 1e12;
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

/** Traduce un vector de E12.balance_pareja a eventos de E17: un gasto anulado lleva su `evento_anulado`. */
function eventosDeVector(v: VectorBalance): EventoCompartido[] {
  const eventos: EventoCompartido[] = [];
  let reloj = 1_792_000_000_000;
  for (const g of v.gastos) {
    const comunes = { id: idDe(g.id), grupo_id: GRUPO, creado_en: ++reloj };
    if (g.tipo === 'pago') {
      eventos.push({
        ...comunes,
        autor: g.de,
        tipo: 'pago_compartido_creado',
        cuerpo: { fecha: '2026-10-12', de: g.de, monto: g.monto },
      });
    } else {
      eventos.push({
        ...comunes,
        autor: g.pago,
        tipo: 'gasto_compartido_creado',
        cuerpo: {
          fecha: '2026-10-12',
          total: g.total,
          pago: g.pago,
          proporcion_a_bp: g.proporcion_a_bp,
          descripcion: '',
          categoria: 'super',
        },
      });
    }
    if (g.anulado) {
      eventos.push({
        id: idDe(`${g.id}-anulado`),
        grupo_id: GRUPO,
        autor: 'a',
        creado_en: ++reloj,
        tipo: 'evento_anulado',
        cuerpo: { id_anulado: idDe(g.id) },
      });
    }
  }
  return eventos;
}

describe('CA-M16-01 · E12.2 con los eventos de E17', () => {
  for (const v of vectores.E12.balance_pareja) {
    it(`${v.id} · debe ${v.esperado.debe ?? 'nadie'} ${v.esperado.monto}`, () => {
      const eventos = eventosDeVector(v);
      expect(saldoGrupo(eventos)).toEqual(v.esperado);
      // La entrada de E12.2 es la del vector: cada gasto o pago, con `anulado: true` si lo apunta una anulación.
      const entrada = entradaBalance(eventos);
      expect(entrada.filter((e) => e.anulado).map((e) => e.id)).toEqual(
        v.gastos.filter((g) => g.anulado).map((g) => idDe(g.id)),
      );
      expect(entrada).toHaveLength(v.gastos.length);
    });
  }

  it('E12-20 con los eventos cifrados y descifrados da lo mismo', async () => {
    const v = vectores.E12.balance_pareja.find((x) => x.id === 'E12-20');
    if (!v) throw new Error('falta E12-20');
    const llave = nuevaLlaveGrupo(aleatorio);
    const filas = await Promise.all(eventosDeVector(v).map((e) => cifrarEvento(cripto, llave, e)));
    const leidos = await Promise.all(filas.map((f) => descifrarFila(cripto, llave, f)));
    expect(saldoGrupo(leidos)).toEqual({ saldo: -160001, debe: 'a', monto: 160001 });
  });
});

// ── CA-M16-02: orden de llegada y duplicados ─────────────────────────────────────────────────────────
const autorArb = fc.constantFrom<'a' | 'b'>('a', 'b');
const idArb = fc.uuid({ version: 4 });
const eventoBaseArb = fc.oneof(
  fc
    .record({
      id: idArb,
      autor: autorArb,
      total: fc.integer({ min: 1, max: 10_000_000 }),
      p: fc.integer({ min: 0, max: 10000 }),
      pago: autorArb,
    })
    .map(({ id, autor, total, p, pago }): EventoCompartido => ({
      id,
      grupo_id: GRUPO,
      autor,
      creado_en: 1,
      tipo: 'gasto_compartido_creado',
      cuerpo: { fecha: '2026-10-12', total, pago, proporcion_a_bp: p, descripcion: 'x', categoria: 'super' },
    })),
  fc
    .record({ id: idArb, autor: autorArb, monto: fc.integer({ min: 1, max: 10_000_000 }) })
    .map(({ id, autor, monto }): EventoCompartido => ({
      id,
      grupo_id: GRUPO,
      autor,
      creado_en: 2,
      tipo: 'pago_compartido_creado',
      cuerpo: { fecha: '2026-10-12', de: autor, monto },
    })),
);

/** Un conjunto de eventos con anulaciones de algunos (incluso de ids que no existen). */
const conjuntoArb = fc.uniqueArray(eventoBaseArb, { selector: (e) => e.id, maxLength: 25 }).chain((base) =>
  fc
    .tuple(
      fc.subarray(base.map((e) => e.id)),
      fc.array(idArb, { maxLength: 2 }),
      fc.array(idArb, { maxLength: 30 }),
    )
    .map(([anular, huerfanos, idsAnulacion]) => {
      const objetivos = [...anular, ...huerfanos];
      const anulaciones: EventoCompartido[] = objetivos.map((id_anulado, i) => ({
        id: idsAnulacion[i] ?? idDe(`anula-${id_anulado}`),
        grupo_id: GRUPO,
        autor: 'b',
        creado_en: 3,
        tipo: 'evento_anulado',
        cuerpo: { id_anulado },
      }));
      return [...base, ...anulaciones];
    }),
);

describe('CA-M16-02 · cualquier orden de llegada, con duplicados, da el mismo saldo', () => {
  it('permutaciones con duplicados, entregadas en lotes (1,000 corridas)', () => {
    fc.assert(
      fc.property(
        conjuntoArb,
        fc.array(fc.nat(), { maxLength: 40 }),
        fc.array(fc.nat(), { maxLength: 60 }),
        fc.integer({ min: 1, max: 6 }),
        (eventos, duplicar, orden, lotes) => {
          const esperado = saldoGrupo(eventos);
          // Llegada: con duplicados y en cualquier orden, repartida en varias descargas que se van fusionando.
          const llegada = [
            ...eventos,
            ...duplicar.flatMap((i) => eventos.slice(i % (eventos.length || 1)).slice(0, 1)),
          ];
          for (let i = llegada.length - 1; i > 0; i--) {
            const j = (orden[i % Math.max(orden.length, 1)] ?? i) % (i + 1);
            const [x, y] = [llegada[i], llegada[j]];
            if (x && y) [llegada[i], llegada[j]] = [y, x];
          }
          let acumulado: EventoCompartido[] = [];
          const tamano = Math.ceil(llegada.length / lotes) || 1;
          for (let i = 0; i < llegada.length; i += tamano) {
            acumulado = fusionarEventos(acumulado, llegada.slice(i, i + tamano));
          }
          expect(saldoGrupo(acumulado)).toEqual(esperado);
          expect(eventosVigentes(acumulado)).toEqual(eventosVigentes(eventos));
          expect(fusionarEventos(acumulado)).toEqual(fusionarEventos(eventos));
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('dos copias distintas de un mismo id: gana la misma sin importar el orden', () => {
    fc.assert(
      fc.property(eventoBaseArb, fc.integer({ min: 1, max: 1000 }), (e, otro) => {
        const copia = { ...e, creado_en: e.creado_en + otro } as EventoCompartido;
        expect(fusionarEventos([e], [copia])).toEqual(fusionarEventos([copia], [e]));
      }),
    );
  });

  it('una anulación cuenta aunque llegue antes que el gasto que anula', () => {
    const [g] = eventosDeVector({
      id: 'x',
      gastos: [{ id: 'g', total: 1000, pago: 'a', proporcion_a_bp: 5000 }],
      esperado: { saldo: 0, debe: null, monto: 0 },
    });
    if (!g) throw new Error('sin gasto');
    const anula: EventoCompartido = {
      id: idDe('anula'),
      grupo_id: GRUPO,
      autor: 'b',
      creado_en: 9,
      tipo: 'evento_anulado',
      cuerpo: { id_anulado: g.id },
    };
    expect(saldoGrupo([anula]).saldo).toBe(0);
    expect(saldoGrupo(fusionarEventos([anula], [g])).saldo).toBe(0);
    expect(saldoGrupo([g]).saldo).toBe(500);
  });
});

// ── Cifrado de extremo a extremo ──────────────────────────────────────────────────────────────────────
const gasto: EventoCompartido = {
  id: '3b9f6c2e-1a7d-4e58-b4c3-9d2a6f1e8b70',
  grupo_id: GRUPO,
  autor: 'a',
  creado_en: 1792022400000,
  tipo: 'gasto_compartido_creado',
  cuerpo: {
    fecha: '2026-10-12',
    total: 120000,
    pago: 'a',
    proporcion_a_bp: 5000,
    descripcion: 'Súper',
    categoria: 'super',
  },
};

async function codigoDe(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    return e instanceof ErrorDominio ? e.codigo : 'otro';
  }
  return undefined;
}

describe('E17 · XChaCha20-Poly1305 y el blob de un evento', () => {
  for (const v of kat.xchacha20poly1305) {
    it(`${v.id} · @noble/ciphers reproduce el vector (${v.id})`, async () => {
      const texto = new TextEncoder().encode(v.texto_utf8);
      const salida = await cripto.xchacha20poly1305Cifrar(
        hex(v.llave_hex),
        hex(v.nonce_hex),
        texto,
        hex(v.aad_hex),
      );
      expect(aHex(salida)).toBe(v.cifrado_y_etiqueta_hex);
      const vuelta = await cripto.xchacha20poly1305Descifrar(
        hex(v.llave_hex),
        hex(v.nonce_hex),
        salida,
        hex(v.aad_hex),
      );
      expect(new TextDecoder().decode(vuelta)).toBe(v.texto_utf8);
    });
  }

  for (const v of kat.eventos) {
    it(`${v.id} · el blob del evento coincide con el de Python y se descifra`, async () => {
      const llave = hex(v.llave_hex);
      expect(serializarContenido(gasto)).toBe(v.contenido_utf8);
      expect(new TextDecoder().decode(aadEvento(v.fila.grupo_id, v.fila.id, v.fila.autor))).toBe(v.aad_utf8);
      const fila = await cifrarEvento(cripto, llave, gasto, { nonce: hex(v.nonce_hex) });
      expect(fila).toEqual({ ...v.fila, blob: v.blob });
      expect(await descifrarFila(cripto, llave, { ...v.fila, blob: v.blob })).toEqual(gasto);
    });
  }

  it('el servidor solo ve grupo_id, id y autor: ni tipo, ni montos, ni descripción', async () => {
    const llave = nuevaLlaveGrupo(aleatorio);
    const fila = await cifrarEvento(cripto, llave, gasto);
    expect(Object.keys(fila).sort()).toEqual(['autor', 'blob', 'grupo_id', 'id']);
    const crudo = Buffer.from(fila.blob, 'base64').toString('latin1');
    for (const claro of ['gasto', 'Súper', 'SÃºper', '120000', 'super', 'proporcion']) {
      expect(crudo).not.toContain(claro);
      expect(fila.blob).not.toContain(claro);
    }
  });

  it('nonce aleatorio de 24 bytes en cada evento: el mismo evento cifra distinto', async () => {
    const llave = nuevaLlaveGrupo(aleatorio);
    const a = await cifrarEvento(cripto, llave, gasto);
    const b = await cifrarEvento(cripto, llave, gasto);
    expect(a.blob).not.toBe(b.blob);
    const nonceA = Buffer.from(a.blob, 'base64').subarray(0, BYTES_NONCE);
    expect(nonceA).toHaveLength(24);
    expect(Buffer.from(b.blob, 'base64').subarray(0, BYTES_NONCE).equals(nonceA)).toBe(false);
  });

  it('llave equivocada, blob alterado o movido a otro grupo, id o autor: evento_ilegible', async () => {
    const llave = nuevaLlaveGrupo(aleatorio);
    const fila = await cifrarEvento(cripto, llave, gasto);
    const bytes = Buffer.from(fila.blob, 'base64');
    bytes[30] = (bytes[30] ?? 0) ^ 1;
    const casos: [Uint8Array, FilaCifrada][] = [
      [nuevaLlaveGrupo(aleatorio), fila],
      [llave, { ...fila, blob: bytes.toString('base64') }],
      [llave, { ...fila, grupo_id: '7f3c1a52-8d4e-4b6a-9c21-0e5f7a8b9c0e' }],
      [llave, { ...fila, id: '3b9f6c2e-1a7d-4e58-b4c3-9d2a6f1e8b71' }],
      [llave, { ...fila, autor: 'b' }],
      [llave, { ...fila, blob: 'no es base64' }],
      [llave, { ...fila, blob: 'AAAA' }],
      [llave, { ...fila, id: 'no-es-uuid' }],
    ];
    for (const [l, f] of casos) expect(await codigoDe(descifrarFila(cripto, l, f))).toBe('evento_ilegible');
  });

  it('un contenido que descifra pero no cumple el esquema también es ilegible', async () => {
    const llave = nuevaLlaveGrupo(aleatorio);
    const nonce = aleatorio(24);
    const malo = new TextEncoder().encode(
      '{"tipo":"gasto_compartido_creado","creado_en":1,"cuerpo":{"total":-5}}',
    );
    const cifrado = await cripto.xchacha20poly1305Cifrar(llave, nonce, malo, aadEvento(GRUPO, gasto.id, 'a'));
    const blob = Buffer.concat([nonce, cifrado]).toString('base64');
    expect(
      await codigoDe(descifrarFila(cripto, llave, { grupo_id: GRUPO, id: gasto.id, autor: 'a', blob })),
    ).toBe('evento_ilegible');
  });

  it('no cifra un evento fuera del esquema ni con una llave o nonce de otro tamaño', async () => {
    const llave = nuevaLlaveGrupo(aleatorio);
    const malo = { ...gasto, id: '3b9f6c2e-1a7d-7e58-b4c3-9d2a6f1e8b70' } as EventoCompartido;
    await expect(cifrarEvento(cripto, llave, malo)).rejects.toThrow();
    expect(await codigoDe(cifrarEvento(cripto, llave.subarray(0, 16), gasto))).toBe('llave_grupo_invalida');
    expect(await codigoDe(cifrarEvento(cripto, llave, gasto, { nonce: aleatorio(12) }))).toBe(
      'nonce_invalido',
    );
  });

  it('cada grupo nuevo tiene una llave nueva de 32 bytes', () => {
    const llaves = new Set(Array.from({ length: 50 }, () => aHex(nuevaLlaveGrupo(aleatorio))));
    expect(llaves.size).toBe(50);
    expect(() => nuevaLlaveGrupo(() => new Uint8Array(8))).toThrow(ErrorDominio);
  });

  it('uuid4 produce UUIDv4 válidos', () => {
    for (let i = 0; i < 100; i++)
      expect(uuid4(aleatorio)).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
  });
});

describe('E17 · código QR', () => {
  const llave = hex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
  const datos = { grupoId: GRUPO, codigoUnion: 'AbCdEfGhIjKlMnOpQrSt-_', llave };

  it('lleva la llave y el código de un solo uso, sin nombres; ida y vuelta', () => {
    const texto = codificarQr(datos);
    expect(texto).toBe(
      `FINANVOZ-PAREJA:1:${GRUPO}:AbCdEfGhIjKlMnOpQrSt-_:AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8`,
    );
    expect(leerQr(texto)).toEqual(datos);
    expect(leerQr(` ${texto}\n`)).toEqual(datos);
  });

  it('ignora cualquier otro QR', () => {
    const bueno = codificarQr(datos);
    for (const malo of [
      '',
      'https://finanvoz.com',
      bueno.replace('FINANVOZ-PAREJA', 'OTRA'),
      bueno.replace(':1:', ':2:'),
      bueno.replace(GRUPO, 'grupo'),
      bueno.replace('AbCdEfGhIjKlMnOpQrSt-_', 'corto'),
      bueno.slice(0, -2),
      `${bueno}:extra`,
      `${bueno}A`,
      'x'.repeat(500),
    ]) {
      expect(leerQr(malo)).toBeNull();
    }
    expect(() => codificarQr({ ...datos, llave: llave.subarray(1) })).toThrow();
    expect(() => codificarQr({ ...datos, codigoUnion: '?' })).toThrow();
    expect(() => codificarQr({ ...datos, grupoId: 'x' })).toThrow();
  });

  it('base64url es estricto', () => {
    expect(deBase64Url(aBase64Url(llave))).toEqual(llave);
    expect(deBase64Url('a')).toBeNull();
    expect(deBase64Url('a+b/')).toBeNull();
  });
});
