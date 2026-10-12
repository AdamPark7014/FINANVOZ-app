import { sql } from 'drizzle-orm';
import type { BaseDatos } from '@cartera/datos';

type Transaccion = BaseDatos['transaction'];

/**
 * Transacciones anidables en la raíz. El driver de Drizzle para expo-sqlite ejecuta `begin` en cada
 * `db.transaction()` llamado sobre la raíz (solo el `tx` que recibe la función usa savepoints), y SQLite
 * rechaza un `begin` dentro de otra transacción. Los servicios y `Libro.registrar()` abren transacciones
 * sobre `ctx.db` aunque ya estén dentro de una, así que aquí la raíz lleva la cuenta de la profundidad: la
 * primera transacción es la del driver y las anidadas son savepoints sobre la misma conexión.
 */
export function conTransaccionesAnidables(db: BaseDatos): BaseDatos {
  const original = db.transaction.bind(db) as Transaccion;
  let profundidad = 0;

  const transaccion = ((fn: Parameters<Transaccion>[0], config?: Parameters<Transaccion>[1]) => {
    if (profundidad === 0) {
      profundidad += 1;
      try {
        return original(fn, config);
      } finally {
        profundidad -= 1;
      }
    }
    const punto = `anidada_${profundidad}`;
    profundidad += 1;
    db.run(sql.raw(`savepoint ${punto}`));
    try {
      const resultado = fn(envuelta as unknown as Parameters<typeof fn>[0]);
      db.run(sql.raw(`release savepoint ${punto}`));
      return resultado;
    } catch (error) {
      db.run(sql.raw(`rollback to savepoint ${punto}`));
      db.run(sql.raw(`release savepoint ${punto}`));
      throw error;
    } finally {
      profundidad -= 1;
    }
  }) as Transaccion;

  const envuelta: BaseDatos = new Proxy(db, {
    get(objetivo, propiedad, receptor) {
      if (propiedad === 'transaction') return transaccion;
      return Reflect.get(objetivo, propiedad, receptor) as unknown;
    },
  });
  return envuelta;
}

/**
 * Solo para pruebas en Node: hace que la raíz de una base better-sqlite3 se comporte como la de expo-sqlite
 * (`begin` / `commit` / `rollback` sin anidar). better-sqlite3 anida solo, así que sin esto las pruebas no
 * verían el error que aparece en el teléfono.
 */
export function transaccionesComoExpo(db: BaseDatos): BaseDatos {
  const transaccion = ((fn: Parameters<Transaccion>[0]) => {
    db.run(sql.raw('begin'));
    try {
      // Como en expo-sqlite, el `tx` anida con savepoints (aquí, los de better-sqlite3 sobre la raíz).
      const resultado = fn(db as unknown as Parameters<typeof fn>[0]);
      db.run(sql.raw('commit'));
      return resultado;
    } catch (error) {
      db.run(sql.raw('rollback'));
      throw error;
    }
  }) as Transaccion;
  return new Proxy(db, {
    get(objetivo, propiedad, receptor) {
      if (propiedad === 'transaction') return transaccion;
      return Reflect.get(objetivo, propiedad, receptor) as unknown;
    },
  });
}
