import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPrivateKey, sign } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { interpretarNotificacion } from '@cartera/core';
import type { FetchNube, PeticionNube, RespuestaNube } from '../nube/http';
import { abrirPrueba, type Prueba } from '../servicios/__pruebas__/base';
import { datosExportacion } from '../privacidad/exportar';
import {
  actualizarPlantillasRemotas,
  plantillasActivas,
  urlPlantillas,
  type DependenciasPlantillas,
} from './actualizar-plantillas';
import { catalogoApp, catalogoEmbebido, fijarPlantillasRemotas } from './catalogo';

const DIR = new URL('../../../../fixtures/plantillas-firmadas/', import.meta.url);
const leer = (nombre: string) => readFileSync(fileURLToPath(new URL(nombre, DIR)));
const kat = JSON.parse(leer('kat.json').toString('utf8')) as {
  llave_publica_hex: string;
  sha256_archivo: string;
  rfc8032_prueba_1: { llave_secreta_hex: string };
};
const ARCHIVO = new Uint8Array(leer('plantillas.json'));
const FIRMA = leer('plantillas.json.sig').toString('utf8');
const URL_JSON = 'https://proyecto.supabase.co/storage/v1/object/public/plantillas/plantillas.json';
const DIA = 24 * 60 * 60 * 1000;

function firmarPrueba(bytes: Uint8Array): string {
  const der = Buffer.from('302e020100300506032b657004220420' + kat.rfc8032_prueba_1.llave_secreta_hex, 'hex');
  return sign(null, bytes, createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })).toString('base64');
}

function version(n: number): { bytes: Uint8Array; firma: string } {
  const json = JSON.parse(Buffer.from(ARCHIVO).toString('utf8')) as Record<string, unknown>;
  json.version = n;
  const bytes = new Uint8Array(Buffer.from(JSON.stringify(json, null, 2) + '\n'));
  return { bytes, firma: firmarPrueba(bytes) };
}

interface Servidor {
  bytes: Uint8Array;
  firma: string;
  etag: string;
  caido: boolean;
  peticiones: { url: string; peticion: PeticionNube }[];
}

function servidor(inicial: { bytes: Uint8Array; firma: string } = { bytes: ARCHIVO, firma: FIRMA }): {
  s: Servidor;
  fetch: FetchNube;
} {
  const s: Servidor = { ...inicial, etag: '"e1"', caido: false, peticiones: [] };
  const respuesta = (status: number, cuerpo: Uint8Array, etag?: string): RespuestaNube => ({
    status,
    headers: { get: (n: string) => (n.toLowerCase() === 'etag' ? (etag ?? null) : null) },
    json: async () => JSON.parse(Buffer.from(cuerpo).toString('utf8')),
    arrayBuffer: async () => cuerpo.slice().buffer,
  });
  const fetch: FetchNube = async (url, peticion) => {
    s.peticiones.push({ url, peticion });
    if (s.caido) throw new TypeError('Network request failed');
    if (url === URL_JSON) {
      if (peticion.headers['If-None-Match'] === s.etag) return respuesta(304, new Uint8Array());
      return respuesta(200, s.bytes, s.etag);
    }
    if (url === `${URL_JSON}.sig`) return respuesta(200, new Uint8Array(Buffer.from(s.firma + '\n')));
    return respuesta(404, new Uint8Array());
  };
  return { s, fetch };
}

const LLAVES = [{ id: 'prueba-rfc8032', llavePublicaHex: kat.llave_publica_hex }];

function deps(fetch: FetchNube, extra: Partial<DependenciasPlantillas> = {}): DependenciasPlantillas {
  return { fetch, url: URL_JSON, llaves: LLAVES, versionApp: '1.0.0', ...extra };
}

function filas(p: Prueba) {
  return p.ctx.db.all<{ version: number; sha256: string; activa: number }>(
    sql.raw('SELECT version, sha256, activa FROM plantilla_remota ORDER BY version'),
  );
}

afterEach(() => fijarPlantillasRemotas(null));

describe('actualizar plantillas remotas (07 §3.1, CA-M10-03)', () => {
  it('la URL es el bucket público `plantillas` del proyecto de Supabase', () => {
    expect(urlPlantillas('https://proyecto.supabase.co/')).toBe(URL_JSON);
  });

  it('sin red sigue con las plantillas embebidas', async () => {
    const p = abrirPrueba();
    const { s, fetch } = servidor();
    s.caido = true;
    expect(await actualizarPlantillasRemotas(p.ctx, deps(fetch))).toEqual({ tipo: 'sin_red' });
    expect(plantillasActivas(p.ctx, deps(fetch))).toBeNull();
    expect(filas(p)).toEqual([]);
    expect(catalogoApp().version).toBe(1);
    // Sin red no cuenta como revisión: al volver la red se intenta de nuevo el mismo día.
    s.caido = false;
    expect((await actualizarPlantillasRemotas(p.ctx, deps(fetch))).tipo).toBe('aceptada');
  });

  it('acepta el archivo firmado, lo guarda en plantilla_remota y la captura lo usa', async () => {
    const p = abrirPrueba();
    const { fetch } = servidor();
    const r = await actualizarPlantillasRemotas(p.ctx, deps(fetch));
    expect(r).toMatchObject({ tipo: 'aceptada', version: 2 });
    expect(filas(p)).toEqual([{ version: 2, sha256: kat.sha256_archivo, activa: 1 }]);
    const activo = plantillasActivas(p.ctx, deps(fetch));
    expect(activo?.version).toBe(2);
    fijarPlantillasRemotas(activo);
    expect(catalogoApp().version).toBe(2);
    expect(
      interpretarNotificacion(
        {
          paquete: 'mx.ejemplo.bancoa',
          titulo: '',
          texto: 'Compraste $150.00 en OXXO con tu tarjeta ***1234',
        },
        catalogoApp(),
      ).plantilla,
    ).toBe('banco_a.compra.v1');
  });

  it('rechaza el archivo con un byte cambiado y conserva lo anterior', async () => {
    const p = abrirPrueba();
    const alterado = ARCHIVO.slice();
    alterado[100] = (alterado[100] ?? 0) ^ 0x20;
    const { fetch } = servidor({ bytes: alterado, firma: FIRMA });
    expect(await actualizarPlantillasRemotas(p.ctx, deps(fetch))).toEqual({
      tipo: 'rechazada',
      motivo: 'firma_invalida',
    });
    expect(filas(p)).toEqual([]);
    expect(plantillasActivas(p.ctx, deps(fetch))).toBeNull();
  });

  it('rechaza una versión menor o igual a la activa', async () => {
    const p = abrirPrueba();
    const v3 = version(3);
    const { s, fetch } = servidor(v3);
    expect(await actualizarPlantillasRemotas(p.ctx, deps(fetch))).toMatchObject({
      tipo: 'aceptada',
      version: 3,
    });
    for (const otra of [{ bytes: ARCHIVO, firma: FIRMA }, version(3)]) {
      Object.assign(s, otra, { etag: `"${Math.random()}"` });
      p.reloj.fijarInstante(p.reloj.ahora() + DIA + 1);
      expect(await actualizarPlantillasRemotas(p.ctx, deps(fetch))).toEqual({
        tipo: 'rechazada',
        motivo: 'version_no_mayor',
      });
    }
    expect(filas(p).map((f) => [f.version, f.activa])).toEqual([[3, 1]]);
    expect(plantillasActivas(p.ctx, deps(fetch))?.version).toBe(3);
    // Una mayor reemplaza a la activa y la anterior queda registrada como inactiva.
    Object.assign(s, version(4), { etag: '"e4"' });
    p.reloj.fijarInstante(p.reloj.ahora() + DIA + 1);
    expect(await actualizarPlantillasRemotas(p.ctx, deps(fetch))).toMatchObject({
      tipo: 'aceptada',
      version: 4,
    });
    expect(filas(p).map((f) => [f.version, f.activa])).toEqual([
      [3, 0],
      [4, 1],
    ]);
  });

  it('revisa una vez al día y manda If-None-Match con el ETag del archivo activo', async () => {
    const p = abrirPrueba();
    const { s, fetch } = servidor();
    await actualizarPlantillasRemotas(p.ctx, deps(fetch));
    const antes = s.peticiones.length;
    expect(await actualizarPlantillasRemotas(p.ctx, deps(fetch))).toEqual({ tipo: 'no_toca' });
    expect(s.peticiones.length).toBe(antes);
    p.reloj.fijarInstante(p.reloj.ahora() + DIA + 1);
    expect(await actualizarPlantillasRemotas(p.ctx, deps(fetch))).toEqual({ tipo: 'sin_cambios' });
    expect(s.peticiones.at(-1)?.peticion.headers['If-None-Match']).toBe('"e1"');
    expect(await actualizarPlantillasRemotas(p.ctx, deps(fetch), { forzar: true })).toEqual({
      tipo: 'sin_cambios',
    });
  });

  it('sin llaves configuradas no descarga nada (build sin llave pública)', async () => {
    const p = abrirPrueba();
    const { s, fetch } = servidor();
    expect(await actualizarPlantillasRemotas(p.ctx, deps(fetch, { llaves: [] }))).toEqual({
      tipo: 'sin_llaves',
    });
    expect(s.peticiones).toEqual([]);
  });

  it('al cargar, vuelve a verificar: con otra llave o el contenido alterado en la base, solo embebidas', async () => {
    const p = abrirPrueba();
    const { fetch } = servidor();
    await actualizarPlantillasRemotas(p.ctx, deps(fetch));
    const otra = [
      { id: 'otra', llavePublicaHex: 'fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025' },
    ];
    expect(plantillasActivas(p.ctx, deps(fetch, { llaves: otra }))).toBeNull();
    p.ctx.db.run(
      sql.raw(
        `UPDATE ajuste SET valor = replace(valor, 'Compraste', 'Compraste ') WHERE clave = 'plantillas_remotas'`,
      ),
    );
    expect(plantillasActivas(p.ctx, deps(fetch))).toBeNull();
  });

  it('tras restaurar sin el contenido, recupera el mismo archivo pero no acepta uno viejo', async () => {
    const p = abrirPrueba();
    const { s, fetch } = servidor(version(3));
    await actualizarPlantillasRemotas(p.ctx, deps(fetch));
    p.ctx.db.run(sql.raw(`DELETE FROM ajuste WHERE clave LIKE 'plantillas_remotas%'`));
    expect(plantillasActivas(p.ctx, deps(fetch))).toBeNull();
    // Un archivo viejo con firma válida no entra aunque el contenido activo se haya perdido.
    Object.assign(s, { bytes: ARCHIVO, firma: FIRMA });
    expect(await actualizarPlantillasRemotas(p.ctx, deps(fetch))).toEqual({
      tipo: 'rechazada',
      motivo: 'version_no_mayor',
    });
    Object.assign(s, version(3));
    p.reloj.fijarInstante(p.reloj.ahora() + DIA + 1);
    expect(await actualizarPlantillasRemotas(p.ctx, deps(fetch))).toMatchObject({
      tipo: 'aceptada',
      version: 3,
    });
    expect(plantillasActivas(p.ctx, deps(fetch))?.version).toBe(3);
  });

  it('una app más vieja que version_minima_app rechaza el archivo y no guarda el ETag', async () => {
    const p = abrirPrueba();
    const { s, fetch } = servidor();
    expect(await actualizarPlantillasRemotas(p.ctx, deps(fetch, { versionApp: '0.1.0' }))).toEqual({
      tipo: 'rechazada',
      motivo: 'app_antigua',
    });
    p.reloj.fijarInstante(p.reloj.ahora() + DIA + 1);
    expect((await actualizarPlantillasRemotas(p.ctx, deps(fetch))).tipo).toBe('aceptada');
    expect(
      s.peticiones.filter((x) => x.url === URL_JSON)[1]?.peticion.headers['If-None-Match'],
    ).toBeUndefined();
  });

  it('el registro del rechazo no guarda contenido del archivo (regla 9)', async () => {
    const p = abrirPrueba();
    const alterado = ARCHIVO.slice();
    alterado[200] = (alterado[200] ?? 0) ^ 0x01;
    const { fetch } = servidor({ bytes: alterado, firma: FIRMA });
    await actualizarPlantillasRemotas(p.ctx, deps(fetch));
    const ajustes = JSON.stringify(datosExportacion(p.ctx).tablas.ajuste);
    expect(ajustes).toContain('firma_invalida');
    expect(ajustes).not.toContain('Compraste');
  });

  it('el catálogo embebido sigue igual sin remotas', () => {
    expect(catalogoApp().plantillas.map((x) => x.id)).toEqual(
      catalogoEmbebido(true).plantillas.map((x) => x.id),
    );
  });
});
