import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { ErrorDominio } from '@cartera/core';
import {
  abrirRespaldo,
  abrirRespaldoConLlave,
  crearLlaveRespaldo,
  derivarLlave,
  ERROR_CORRUPTO,
  escribirRespaldo,
  leerEncabezado,
  normalizarContrasena,
  serializarEncabezado,
  type CriptoRespaldo,
} from './index';
import { criptoNode } from './node';

const raiz = (ruta: string) => fileURLToPath(new URL(`../../../${ruta}`, import.meta.url));

interface VectorKdf {
  id: string;
  descripcion: string;
  contrasena: string;
  sal_hex: string;
  n: number;
  r: number;
  p: number;
  largo: number;
  esperado_hex: string;
}
const vectores = JSON.parse(readFileSync(raiz('fixtures/motores/vectores.json'), 'utf8')) as {
  E16: { kdf: VectorKdf[] };
};
const kat = JSON.parse(readFileSync(raiz('fixtures/respaldo/kat.json'), 'utf8')) as {
  archivo: string;
  archivo_alterado: string;
  contrasena: string;
  clave_hex: string;
  encabezado: Record<string, unknown>;
  encabezado_bytes_utf8: string;
  contenido_descomprimido: string;
  esperado_alterado: string;
};
const leer = (ruta: string) => new Uint8Array(readFileSync(raiz(ruta)));
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const deHex = (s: string) => new Uint8Array(Buffer.from(s, 'hex'));

/** Los vectores del ejemplo usan n = 2^14: solo se permite con la opción explícita de pruebas (E16). */
const PRUEBA = { permitirParametrosDePrueba: true } as const;

async function codigoDe(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
  } catch (e) {
    if (e instanceof ErrorDominio) return e.codigo;
    throw e;
  }
  throw new Error('se esperaba un error');
}

/** Envuelve la criptografía de Node para contar cuántas veces se deriva una llave. */
function criptoEspiada(): CriptoRespaldo & { scrypt: ReturnType<typeof vi.fn> } {
  return { ...criptoNode, scrypt: vi.fn(criptoNode.scrypt) };
}

describe('E16.kdf', () => {
  for (const v of vectores.E16.kdf) {
    it(`${v.id} · ${v.descripcion}`, { timeout: 60_000 }, async () => {
      const llave = await derivarLlave(criptoNode, v.contrasena, deHex(v.sal_hex), {
        n: v.n,
        r: v.r,
        p: v.p,
        largo: v.largo,
      });
      expect(hex(llave)).toBe(v.esperado_hex);
    });
  }

  it('E16-03 · la forma descompuesta (n + tilde combinante) se normaliza con NFKC', () => {
    const v = vectores.E16.kdf.find((x) => x.id === 'E16-03');
    expect(v).toBeDefined();
    const compuesta = v?.contrasena.normalize('NFC') ?? '';
    const descompuesta = compuesta.normalize('NFD');
    expect(descompuesta).not.toBe(compuesta);
    expect(hex(normalizarContrasena(descompuesta))).toBe(hex(normalizarContrasena(compuesta)));
  });
});

describe('E16 · fixtures/respaldo (CA-M9-01, parte de Node)', () => {
  it('el encabezado canónico (llaves ordenadas, sin espacios) da los bytes de kat.json', () => {
    expect(serializarEncabezado(kat.encabezado)).toBe(kat.encabezado_bytes_utf8);
  });

  it('lee el encabezado del ejemplo sin derivar nada', () => {
    const { encabezado, bytesEncabezado } = leerEncabezado(leer(kat.archivo), PRUEBA);
    expect(encabezado).toEqual(kat.encabezado);
    expect(Buffer.from(bytesEncabezado).toString('utf8')).toBe(kat.encabezado_bytes_utf8);
  });

  it('abre ejemplo.cartera con la contraseña de kat.json y reproduce su contenido', async () => {
    const r = await abrirRespaldo(criptoNode, leer(kat.archivo), kat.contrasena, PRUEBA);
    expect(r.json).toBe(kat.contenido_descomprimido);
    expect(r.encabezado.creado_en).toBe('2026-10-11T18:00:00Z');
    expect(hex(r.llave.llave)).toBe(kat.clave_hex);
    expect(r.llave).toMatchObject({ n: 16384, r: 8, p: 1 });
  });

  it('abre el ejemplo con la llave de kat.json (sin contraseña)', async () => {
    const r = await abrirRespaldoConLlave(criptoNode, leer(kat.archivo), deHex(kat.clave_hex), PRUEBA);
    expect(r.json).toBe(kat.contenido_descomprimido);
  });

  it('rechaza ejemplo-alterado.cartera y una contraseña equivocada con el mismo error', async () => {
    expect(ERROR_CORRUPTO).toBe(kat.esperado_alterado);
    const alterado = await codigoDe(
      abrirRespaldo(criptoNode, leer(kat.archivo_alterado), kat.contrasena, PRUEBA),
    );
    const equivocada = await codigoDe(
      abrirRespaldo(criptoNode, leer(kat.archivo), 'otra contraseña', PRUEBA),
    );
    expect(alterado).toBe(kat.esperado_alterado);
    expect(equivocada).toBe(kat.esperado_alterado);
  });

  it('un byte alterado del encabezado (AAD) también falla con el mismo error', async () => {
    const archivo = leer(kat.archivo);
    const i = 12 + kat.encabezado_bytes_utf8.indexOf('18:00:00Z');
    archivo[i] = '7'.charCodeAt(0);
    expect(await codigoDe(abrirRespaldo(criptoNode, archivo, kat.contrasena, PRUEBA))).toBe(ERROR_CORRUPTO);
  });

  it('sin la opción de pruebas, n = 2^14 está fuera de la lista blanca y no deriva la llave', async () => {
    const cripto = criptoEspiada();
    expect(await codigoDe(abrirRespaldo(cripto, leer(kat.archivo), kat.contrasena))).toBe(
      'respaldo_parametros_no_permitidos',
    );
    expect(cripto.scrypt).not.toHaveBeenCalled();
  });
});

/** Arma un archivo con un encabezado arbitrario (para probar la validación previa a derivar). */
function conEncabezado(encabezado: unknown, cola = new Uint8Array(32)): Uint8Array {
  const json = Buffer.from(JSON.stringify(encabezado), 'utf8');
  const archivo = new Uint8Array(12 + json.length + cola.length);
  archivo.set(Buffer.from('CARTERA1', 'ascii'), 0);
  new DataView(archivo.buffer).setUint32(8, json.length, false);
  archivo.set(json, 12);
  archivo.set(cola, 12 + json.length);
  return archivo;
}

describe('E16 · lista blanca del encabezado (antes de derivar)', () => {
  const base = kat.encabezado as {
    kdf: Record<string, unknown>;
    cifrado: Record<string, unknown>;
  } & Record<string, unknown>;
  const casos: [string, unknown, string][] = [
    [
      'n = 2^20 (memoria excesiva)',
      { ...base, kdf: { ...base.kdf, n: 2 ** 20 } },
      'respaldo_parametros_no_permitidos',
    ],
    ['n = 2^15', { ...base, kdf: { ...base.kdf, n: 2 ** 15 } }, 'respaldo_parametros_no_permitidos'],
    ['r = 16', { ...base, kdf: { ...base.kdf, n: 2 ** 17, r: 16 } }, 'respaldo_parametros_no_permitidos'],
    ['p = 2', { ...base, kdf: { ...base.kdf, n: 2 ** 17, p: 2 } }, 'respaldo_parametros_no_permitidos'],
    [
      'sal de 8 bytes',
      { ...base, kdf: { ...base.kdf, n: 2 ** 17, sal_b64: 'AAECAwQFBgc=' } },
      'respaldo_parametros_no_permitidos',
    ],
    [
      'nonce de 16 bytes',
      {
        ...base,
        kdf: { ...base.kdf, n: 2 ** 17 },
        cifrado: { ...base.cifrado, nonce_b64: 'AAECAwQFBgcICQoLDA0ODw==' },
      },
      'respaldo_parametros_no_permitidos',
    ],
    ['otro kdf', { ...base, kdf: { ...base.kdf, alg: 'pbkdf2' } }, 'respaldo_parametros_no_permitidos'],
    [
      'otro cifrado',
      { ...base, cifrado: { ...base.cifrado, alg: 'AES-128-CBC' } },
      'respaldo_parametros_no_permitidos',
    ],
    ['versión futura', { ...base, version: 2 }, 'respaldo_version_no_soportada'],
    ['otro formato', { ...base, formato: 'otra-cosa' }, 'respaldo_no_reconocido'],
    ['campo extra', { ...base, extra: 1 }, 'respaldo_parametros_no_permitidos'],
  ];
  for (const [nombre, encabezado, codigo] of casos) {
    it(`rechaza ${nombre} sin derivar`, async () => {
      const cripto = criptoEspiada();
      expect(await codigoDe(abrirRespaldo(cripto, conEncabezado(encabezado), 'x', PRUEBA))).toBe(codigo);
      expect(cripto.scrypt).not.toHaveBeenCalled();
    });
  }

  it('rechaza un archivo sin la magia CARTERA1', async () => {
    const archivo = leer(kat.archivo);
    archivo[0] = 0x58;
    expect(await codigoDe(abrirRespaldo(criptoNode, archivo, kat.contrasena, PRUEBA))).toBe(
      'respaldo_no_reconocido',
    );
  });

  it('rechaza un encabezado de más de 4 KiB sin leerlo', async () => {
    const archivo = conEncabezado({ relleno: 'x'.repeat(5000) });
    expect(await codigoDe(abrirRespaldo(criptoNode, archivo, 'x', PRUEBA))).toBe('respaldo_no_reconocido');
  });

  it('rechaza un archivo truncado', async () => {
    const archivo = leer(kat.archivo).subarray(0, 20);
    expect(await codigoDe(abrirRespaldo(criptoNode, archivo, 'x', PRUEBA))).toBe('respaldo_no_reconocido');
  });
});

describe('E16 · escribir y abrir', () => {
  it('ida y vuelta con parámetros de producción (n = 2^17); nonce nuevo en cada respaldo, misma sal', async () => {
    const llave = await crearLlaveRespaldo(criptoNode, 'mi contraseña de respaldo');
    expect(llave.n).toBe(2 ** 17);
    expect(llave.sal).toHaveLength(16);
    expect(llave.llave).toHaveLength(32);
    const contenido = JSON.stringify({ hola: 'mundo', monto: 150000 });
    const a = await escribirRespaldo(criptoNode, llave, contenido, {
      creadoEn: '2026-10-12T10:00:00Z',
      versionEsquema: 2,
    });
    const b = await escribirRespaldo(criptoNode, llave, contenido, {
      creadoEn: '2026-10-12T10:00:00Z',
      versionEsquema: 2,
    });
    const ea = leerEncabezado(a).encabezado;
    const eb = leerEncabezado(b).encabezado;
    expect(ea.kdf.sal_b64).toBe(eb.kdf.sal_b64);
    expect(ea.cifrado.nonce_b64).not.toBe(eb.cifrado.nonce_b64);
    expect(ea).toMatchObject({
      formato: 'cartera-respaldo',
      version: 1,
      version_esquema: 2,
      contenido: 'json+gzip',
    });
    const abierto = await abrirRespaldo(criptoNode, a, 'mi contraseña de respaldo');
    expect(abierto.json).toBe(contenido);
    // El contenido no viaja legible: ni el texto ni el monto aparecen en claro.
    const texto = Buffer.from(a).toString('latin1');
    expect(texto).not.toContain('mundo');
    expect(texto).not.toContain('150000');
  });

  it('cambiar la contraseña genera sal y llave nuevas; el respaldo viejo abre con la vieja', async () => {
    const vieja = await crearLlaveRespaldo(criptoNode, 'vieja', { n: 2 ** 14, ...PRUEBA });
    const nueva = await crearLlaveRespaldo(criptoNode, 'nueva', { n: 2 ** 14, ...PRUEBA });
    expect(hex(nueva.sal)).not.toBe(hex(vieja.sal));
    expect(hex(nueva.llave)).not.toBe(hex(vieja.llave));
    const respaldoViejo = await escribirRespaldo(criptoNode, vieja, '{"v":1}', {
      creadoEn: 'x',
      versionEsquema: 1,
      ...PRUEBA,
    });
    expect((await abrirRespaldo(criptoNode, respaldoViejo, 'vieja', PRUEBA)).json).toBe('{"v":1}');
    expect(await codigoDe(abrirRespaldo(criptoNode, respaldoViejo, 'nueva', PRUEBA))).toBe(ERROR_CORRUPTO);
  });

  it('rechaza un contenido descomprimido mayor que el límite', async () => {
    const llave = await crearLlaveRespaldo(criptoNode, 'x', { n: 2 ** 14, ...PRUEBA });
    const archivo = await escribirRespaldo(criptoNode, llave, 'a'.repeat(10_000), {
      creadoEn: 'x',
      versionEsquema: 1,
      ...PRUEBA,
    });
    expect(
      await codigoDe(abrirRespaldo(criptoNode, archivo, 'x', { ...PRUEBA, limiteDescomprimido: 5_000 })),
    ).toBe('respaldo_demasiado_grande');
  });

  it('no escribe con una llave de parámetros fuera de la lista blanca', async () => {
    const llave = await crearLlaveRespaldo(criptoNode, 'x', { n: 2 ** 14, ...PRUEBA });
    expect(
      await codigoDe(
        escribirRespaldo(criptoNode, { ...llave, n: 2 ** 20 }, '{}', { creadoEn: 'x', versionEsquema: 1 }),
      ),
    ).toBe('respaldo_parametros_no_permitidos');
  });
});
