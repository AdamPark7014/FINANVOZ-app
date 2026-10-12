import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { interpretarNotificacion } from '@cartera/core';
import sinteticas from '../../../../fixtures/notificaciones/plantillas.ejemplo.json';
import {
  catalogoConRemotas,
  compararVersiones,
  esLlaveDePruebaRfc8032,
  leerLlavesPlantillas,
  verificarPlantillasRemotas,
  type LlavePlantillas,
} from './plantillas-remotas';

const DIR = new URL('../../../../fixtures/plantillas-firmadas/', import.meta.url);
const leer = (nombre: string) => readFileSync(fileURLToPath(new URL(nombre, DIR)));

interface Kat {
  rfc8032_prueba_1: {
    llave_secreta_hex: string;
    llave_publica_hex: string;
    mensaje_hex: string;
    firma_hex: string;
  };
  firma_base64: string;
  llave_publica_hex: string;
  sha256_archivo: string;
  version_embebida_en_las_pruebas: number;
}
const kat = JSON.parse(leer('kat.json').toString('utf8')) as Kat;
const archivo = new Uint8Array(leer('plantillas.json'));
const firma = leer('plantillas.json.sig').toString('utf8');

/** "Build de depuración configurado con la llave pública de prueba" (CA-M10-03). */
const LLAVES_PRUEBA: LlavePlantillas[] = [{ id: 'prueba-rfc8032', llavePublicaHex: kat.llave_publica_hex }];
const BASE = { firmaBase64: firma, llaves: LLAVES_PRUEBA, versionActiva: 1, versionApp: '1.0.0' };

/** Firma `bytes` con la llave secreta del vector 1 de RFC 8032 (la de los fixtures). */
function firmarPrueba(bytes: Uint8Array): string {
  const der = Buffer.from('302e020100300506032b657004220420' + kat.rfc8032_prueba_1.llave_secreta_hex, 'hex');
  return sign(null, bytes, createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })).toString('base64');
}

function conCambios(cambiar: (json: Record<string, unknown>) => void): Uint8Array {
  const json = JSON.parse(Buffer.from(archivo).toString('utf8')) as Record<string, unknown>;
  cambiar(json);
  return new Uint8Array(Buffer.from(JSON.stringify(json)));
}

describe('plantillas remotas firmadas (07 §3.1, CA-M10-03)', () => {
  it('el vector 1 de RFC 8032 verifica con la implementación elegida', () => {
    const v = kat.rfc8032_prueba_1;
    const r = verificarPlantillasRemotas({
      ...BASE,
      bytes: new Uint8Array(Buffer.from(v.mensaje_hex, 'hex')),
      firmaBase64: Buffer.from(v.firma_hex, 'hex').toString('base64'),
      llaves: [{ id: 'kat', llavePublicaHex: v.llave_publica_hex }],
    });
    // La firma verifica: lo que falla es el JSON (el mensaje del vector está vacío).
    expect(r).toEqual({ ok: false, motivo: 'json_invalido' });
  });

  it('acepta fixtures/plantillas-firmadas/plantillas.json con su firma', () => {
    expect(createHash('sha256').update(archivo).digest('hex')).toBe(kat.sha256_archivo);
    const r = verificarPlantillasRemotas({ ...BASE, bytes: archivo });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.archivo.version).toBe(2);
    expect(r.version).toBe(2);
    expect(r.sha256).toBe(kat.sha256_archivo);
    expect(r.firma).toBe(kat.firma_base64);
    expect(r.llave).toBe('prueba-rfc8032');
    expect(r.catalogo.plantillas.length).toBeGreaterThan(0);
  });

  it('rechaza el archivo con un solo byte cambiado, en cualquier posición', () => {
    for (const i of [0, 1, Math.floor(archivo.length / 2), archivo.length - 1]) {
      const alterado = archivo.slice();
      alterado[i] = (alterado[i] ?? 0) ^ 0x01;
      expect(verificarPlantillasRemotas({ ...BASE, bytes: alterado })).toEqual({
        ok: false,
        motivo: 'firma_invalida',
      });
    }
  });

  it('rechaza una firma válida con otra llave pública y una firma mal formada', () => {
    const otra = 'fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025'; // vector 2 de RFC 8032
    expect(
      verificarPlantillasRemotas({
        ...BASE,
        bytes: archivo,
        llaves: [{ id: 'otra', llavePublicaHex: otra }],
      }),
    ).toEqual({ ok: false, motivo: 'firma_invalida' });
    for (const f of ['', 'no es base64', firma.slice(0, 40), Buffer.alloc(64).toString('base64')]) {
      expect(verificarPlantillasRemotas({ ...BASE, bytes: archivo, firmaBase64: f })).toEqual({
        ok: false,
        motivo: 'firma_invalida',
      });
    }
  });

  it('acepta si verifica con cualquiera de las llaves embebidas (rotación)', () => {
    const otra = {
      id: 'otra',
      llavePublicaHex: 'fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025',
    };
    const r = verificarPlantillasRemotas({ ...BASE, bytes: archivo, llaves: [otra, ...LLAVES_PRUEBA] });
    expect(r.ok && r.llave).toBe('prueba-rfc8032');
  });

  it('sin llaves configuradas no acepta nada', () => {
    expect(verificarPlantillasRemotas({ ...BASE, bytes: archivo, llaves: [] })).toEqual({
      ok: false,
      motivo: 'sin_llaves',
    });
  });

  it('rechaza una versión menor o igual a la activa aunque la firma sea válida', () => {
    for (const versionActiva of [2, 3, 50]) {
      expect(verificarPlantillasRemotas({ ...BASE, bytes: archivo, versionActiva })).toEqual({
        ok: false,
        motivo: 'version_no_mayor',
      });
    }
    const v1 = conCambios((j) => (j.version = 1));
    expect(verificarPlantillasRemotas({ ...BASE, bytes: v1, firmaBase64: firmarPrueba(v1) })).toEqual({
      ok: false,
      motivo: 'version_no_mayor',
    });
  });

  it('la misma versión con el mismo SHA-256 se acepta solo para recuperar el contenido perdido', () => {
    const r = verificarPlantillasRemotas({
      ...BASE,
      bytes: archivo,
      versionActiva: 2,
      recuperar: { version: 2, sha256: kat.sha256_archivo },
    });
    expect(r.ok).toBe(true);
    expect(
      verificarPlantillasRemotas({
        ...BASE,
        bytes: archivo,
        versionActiva: 2,
        recuperar: { version: 2, sha256: '0'.repeat(64) },
      }),
    ).toEqual({ ok: false, motivo: 'version_no_mayor' });
  });

  it('rechaza si la app es más vieja que version_minima_app', () => {
    expect(verificarPlantillasRemotas({ ...BASE, bytes: archivo, versionApp: '0.1.0' })).toEqual({
      ok: false,
      motivo: 'app_antigua',
    });
    expect(verificarPlantillasRemotas({ ...BASE, bytes: archivo, versionApp: '1.0.1' }).ok).toBe(true);
  });

  it('firmado pero inválido: JSON roto, sin campos o una RegExp que no compila descartan el archivo completo', () => {
    const roto = new Uint8Array(Buffer.from('{"version": 3,'));
    expect(verificarPlantillasRemotas({ ...BASE, bytes: roto, firmaBase64: firmarPrueba(roto) })).toEqual({
      ok: false,
      motivo: 'json_invalido',
    });
    const sinMinima = conCambios((j) => {
      j.version = 3;
      delete j.version_minima_app;
    });
    expect(
      verificarPlantillasRemotas({ ...BASE, bytes: sinMinima, firmaBase64: firmarPrueba(sinMinima) }),
    ).toEqual({ ok: false, motivo: 'formato_invalido' });
    const regexMala = conCambios((j) => {
      j.version = 3;
      const [primera] = j.plantillas as { patron: string }[];
      if (primera) primera.patron = '(sin cerrar';
    });
    expect(
      verificarPlantillasRemotas({ ...BASE, bytes: regexMala, firmaBase64: firmarPrueba(regexMala) }),
    ).toEqual({ ok: false, motivo: 'plantillas_invalidas' });
    const latin1 = new Uint8Array([0x7b, 0xe9, 0x7d]);
    expect(verificarPlantillasRemotas({ ...BASE, bytes: latin1, firmaBase64: firmarPrueba(latin1) })).toEqual(
      {
        ok: false,
        motivo: 'json_invalido',
      },
    );
  });
});

describe('catálogo con plantillas remotas', () => {
  const remoto = (() => {
    const r = verificarPlantillasRemotas({ ...BASE, bytes: archivo });
    if (!r.ok) throw new Error('el fixture no verifica');
    return r.archivo;
  })();

  it('sin remotas es el catálogo embebido', () => {
    const c = catalogoConRemotas([sinteticas], null);
    expect(c.version).toBe(1);
    expect(c.bancos.map((b) => b.id)).toEqual(sinteticas.bancos.map((b) => b.id));
  });

  it('una remota gana sobre la embebida del mismo id de banco; las demás embebidas siguen', () => {
    const embebida = {
      version: 1,
      bancos: [
        { id: 'banco_a', nombre: 'Viejo', paquetes_android: ['mx.ejemplo.bancoa'] },
        { id: 'solo_embebido', nombre: 'Solo embebido', paquetes_android: ['mx.ejemplo.soloembebido'] },
      ],
      plantillas: [
        { id: 'banco_a.vieja.v0', banco: 'banco_a', tipo: 'cargo', campo: 'texto', patron: '^Compraste' },
        { id: 'solo.cargo.v1', banco: 'solo_embebido', tipo: 'cargo', campo: 'texto', patron: '^Pagaste' },
      ],
    };
    const c = catalogoConRemotas([embebida], remoto);
    expect(c.version).toBe(2);
    expect(c.bancos.find((b) => b.id === 'banco_a')?.nombre).toBe('Banco A (débito)');
    expect(c.bancos.some((b) => b.id === 'solo_embebido')).toBe(true);
    expect(c.plantillas.some((p) => p.id === 'banco_a.vieja.v0')).toBe(false);
    expect(c.plantillas.some((p) => p.id === 'solo.cargo.v1')).toBe(true);
    const r = interpretarNotificacion(
      { paquete: 'mx.ejemplo.bancoa', titulo: '', texto: 'Compraste $150.00 en OXXO con tu tarjeta ***1234' },
      c,
    );
    expect(r.plantilla).toBe('banco_a.compra.v1');
  });

  it('un banco embebido con otro id pero un paquete que la remota reclama se descarta', () => {
    const embebida = {
      version: 1,
      bancos: [{ id: 'alias_a', paquetes_android: ['mx.ejemplo.bancoa'] }],
      plantillas: [],
    };
    const c = catalogoConRemotas([embebida], remoto);
    expect(c.bancos.some((b) => b.id === 'alias_a')).toBe(false);
  });
});

describe('llaves de plantillas (configuración del build, CA-M10-04)', () => {
  const prueba = kat.llave_publica_hex;
  const otra = 'fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025';

  it('lee `id:hex` separados por coma e ignora lo mal formado', () => {
    expect(
      leerLlavesPlantillas(` a:${otra} , b:${prueba.toUpperCase()},malo,c:12`, { produccion: false }),
    ).toEqual([
      { id: 'a', llavePublicaHex: otra },
      { id: 'b', llavePublicaHex: prueba },
    ]);
    expect(leerLlavesPlantillas(undefined, { produccion: false })).toEqual([]);
    expect(leerLlavesPlantillas('', { produccion: true })).toEqual([]);
  });

  it('reconoce la llave de prueba de RFC 8032 sin escribirla en el código', () => {
    expect(esLlaveDePruebaRfc8032(prueba)).toBe(true);
    expect(esLlaveDePruebaRfc8032(prueba.toUpperCase())).toBe(true);
    expect(esLlaveDePruebaRfc8032(otra)).toBe(false);
    const fuente = readFileSync(fileURLToPath(new URL('./plantillas-remotas.ts', import.meta.url)), 'utf8');
    expect(fuente.toLowerCase()).not.toContain(prueba);
  });

  it('en producción descarta la llave de prueba aunque se configure', () => {
    expect(leerLlavesPlantillas(`prueba:${prueba},prod:${otra}`, { produccion: true })).toEqual([
      { id: 'prod', llavePublicaHex: otra },
    ]);
    expect(leerLlavesPlantillas(`prueba:${prueba}`, { produccion: false })).toHaveLength(1);
  });
});

describe('compararVersiones', () => {
  it('compara x.y.z numéricamente', () => {
    expect(compararVersiones('1.0.0', '1.0.0')).toBe(0);
    expect(compararVersiones('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(compararVersiones('0.1.0', '1.0.0')).toBeLessThan(0);
    expect(compararVersiones('1.0', '1.0.0')).toBeNull();
  });
});
