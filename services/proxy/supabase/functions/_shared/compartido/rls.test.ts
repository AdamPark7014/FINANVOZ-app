// CA-M16-04 (parte RLS) · la segunda barrera de `03 §5.10` con la migración real en PGlite, como si alguien llamara
// a PostgREST directo con su JWT: un miembro lee los eventos de los dos autores (también con el grupo cerrado) y
// publica solo con su propio autor y solo con el grupo abierto; cualquier otra cuenta no ve filas; nadie con la
// llave anon o un JWT de usuario puede llamar las funciones `compartido_*`, cambiar o borrar eventos ni ver el hash
// del código de unión.
import { randomBytes, randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { abrirServidor, peticion, type ServidorPrueba } from './__pruebas__/servidor.ts';

let s: ServidorPrueba;
let A: string;
let B: string;
let C: string;
let grupo: string;

const blob = () => Buffer.from(randomBytes(100)).toString('base64');

beforeEach(async () => {
  s = await abrirServidor();
  [A, B, C] = [await s.usuario(), await s.usuario(), await s.usuario()];
  const creado = (await (await s.manejador(peticion(A, 'grupos'))).json()) as Record<string, string>;
  grupo = creado.grupo_id as string;
  await s.manejador(peticion(B, 'unirse', { grupo_id: grupo, codigo_union: creado.codigo_union }));
});

const insertar = (usuario: string, autor: string, g = grupo) =>
  s.como(usuario, 'insert into eventos_compartidos (grupo_id, id, autor, blob) values ($1, $2, $3, $4)', [
    g,
    randomUUID(),
    autor,
    blob(),
  ]);
const eventos = (usuario: string | null) =>
  s.como<{ autor: string }>(usuario, 'select autor from eventos_compartidos order by autor');

describe('RLS de eventos_compartidos, grupos_compartidos y miembros_compartidos', () => {
  it('un miembro publica solo con su autor y lee los eventos de los dos', async () => {
    await insertar(A, 'a');
    await insertar(B, 'b');
    await expect(insertar(A, 'b')).rejects.toThrow(/row-level security/);
    await expect(insertar(B, 'a')).rejects.toThrow(/row-level security/);
    expect(await eventos(A)).toEqual([{ autor: 'a' }, { autor: 'b' }]);
    expect(await eventos(B)).toEqual([{ autor: 'a' }, { autor: 'b' }]);
  });

  it('una tercera cuenta no ve filas ni puede publicar', async () => {
    await insertar(A, 'a');
    expect(await eventos(C)).toEqual([]);
    expect(await s.como(C, 'select id from grupos_compartidos')).toEqual([]);
    expect(await s.como(C, 'select usuario from miembros_compartidos')).toEqual([]);
    await expect(insertar(C, 'a')).rejects.toThrow(/row-level security/);
    await expect(insertar(C, 'b')).rejects.toThrow(/row-level security/);
  });

  it('con el grupo cerrado los miembros leen pero nadie publica', async () => {
    await insertar(A, 'a');
    await s.manejador(peticion(B, 'salir', { grupo_id: grupo }));
    await expect(insertar(A, 'a')).rejects.toThrow(/row-level security/);
    await expect(insertar(B, 'b')).rejects.toThrow(/row-level security/);
    expect(await eventos(B)).toEqual([{ autor: 'a' }]);
    expect(
      await s.como<{ cerrado: boolean }>(
        A,
        'select cerrado_en is not null as cerrado from grupos_compartidos',
      ),
    ).toEqual([{ cerrado: true }]);
  });

  it('nadie cambia ni borra eventos, ni ve el hash del código de unión', async () => {
    await insertar(A, 'a');
    await expect(s.como(A, `update eventos_compartidos set autor = 'b'`)).rejects.toThrow(
      /permission denied/,
    );
    await expect(s.como(A, 'delete from eventos_compartidos')).rejects.toThrow(/permission denied/);
    await expect(s.como(A, 'select codigo_union_hash from grupos_compartidos')).rejects.toThrow(
      /permission denied/,
    );
    await expect(s.como(A, `update grupos_compartidos set cerrado_en = null`)).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      s.como(A, `insert into miembros_compartidos (grupo_id, usuario, autor) values ($1, $2, 'b')`, [
        grupo,
        C,
      ]),
    ).rejects.toThrow(/permission denied/);
  });

  it('las funciones compartido_* solo las llama el service role', async () => {
    for (const usuario of [A, null]) {
      await expect(
        s.como(usuario, `select public.compartido_salir($1::uuid, $2::uuid)`, [A, grupo]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        s.como(usuario, `select public.compartido_unirse($1::uuid, $2::uuid, $3)`, [
          C,
          grupo,
          'x'.repeat(64),
        ]),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it('sin sesión (rol anon) no ve nada', async () => {
    await insertar(A, 'a');
    await expect(eventos(null)).rejects.toThrow(/permission denied/);
  });
});
