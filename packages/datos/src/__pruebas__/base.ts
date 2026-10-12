import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { Libro } from '../libro';
import { cuenta, tarjeta } from '../esquema';
import { CUENTAS_SISTEMA, idCategoria } from '../semillas';

/** Carpeta de migraciones SQL (formato Drizzle: `meta/_journal.json` + `NNNN_nombre.sql`). */
export const CARPETA_MIGRACIONES = fileURLToPath(new URL('../../migraciones', import.meta.url));

/** Aplica las migraciones con el migrador de Drizzle sobre una base `better-sqlite3` ya abierta. */
export function migrar(db: BetterSQLite3Database): void {
  migrate(db, { migrationsFolder: CARPETA_MIGRACIONES });
}

/** Cuentas de usuario de prueba con los nombres de los casos de `04 §4`. */
export const C = {
  efectivo: 'efectivo',
  bbva: 'bbva',
  ahorro: 'ahorro',
  nu: 'nu',
  oro: 'oro',
  oroMsi: 'oro_msi_plan1',
  t8812: 'tarjeta_8812',
  juan: 'juan',
  hermano: 'hermano',
  caro: 'caro',
  amigo1: 'amigo1',
  amigo2: 'amigo2',
  amigo3: 'amigo3',
  tanda: 'tanda_1',
  ana: 'ana_pareja',
  archivada: 'cuenta_vieja',
  ...CUENTAS_SISTEMA,
  antojos: idCategoria('antojos'),
  comidaFuera: idCategoria('comida_fuera'),
  hogar: idCategoria('hogar'),
  ropa: idCategoria('ropa'),
  super: idCategoria('super'),
  transporte: idCategoria('transporte'),
  variosEfectivo: idCategoria('varios_efectivo'),
  sueldo: idCategoria('sueldo'),
  honorarios: idCategoria('honorarios'),
  regaloRecibido: idCategoria('regalo_recibido'),
  ingresoReembolso: idCategoria('reembolso'),
} as const;

function sembrarPlan(db: BetterSQLite3Database): void {
  const fila = (
    id: string,
    naturaleza: 'activo' | 'pasivo' | 'contraparte',
    subtipo: string,
    extra: Partial<typeof cuenta.$inferInsert> = {},
  ): typeof cuenta.$inferInsert => ({ id, naturaleza, subtipo, nombre: id, creadaEn: 0, ...extra });
  db.insert(cuenta)
    .values([
      fila(C.efectivo, 'activo', 'efectivo', { liquida: 1 }),
      fila(C.bbva, 'activo', 'debito', { liquida: 1, ultimos4: '1234' }),
      fila(C.ahorro, 'activo', 'ahorro'),
      fila(C.nu, 'pasivo', 'tarjeta_credito'),
      fila(C.oro, 'pasivo', 'tarjeta_credito'),
      fila(C.t8812, 'pasivo', 'tarjeta_credito', { ultimos4: '8812' }),
      fila(C.juan, 'contraparte', 'persona'),
      fila(C.hermano, 'contraparte', 'persona', { apartarDeuda: 1 }),
      fila(C.caro, 'contraparte', 'persona'),
      fila(C.amigo1, 'contraparte', 'persona'),
      fila(C.amigo2, 'contraparte', 'persona'),
      fila(C.amigo3, 'contraparte', 'persona'),
      fila(C.tanda, 'contraparte', 'tanda'),
      fila(C.ana, 'contraparte', 'pareja', { apartarDeuda: 1 }),
      fila(C.archivada, 'activo', 'debito', { liquida: 1, archivada: 1 }),
    ])
    .run();
  db.insert(cuenta)
    .values(fila(C.oroMsi, 'pasivo', 'msi', { padreId: C.oro }))
    .run();
  db.insert(tarjeta)
    .values(
      [C.nu, C.oro, C.t8812].map((cuentaId) => ({
        cuentaId,
        diaCorte: 5,
        diasParaPagar: 20,
        limiteCredito: 5_000_000,
        alta: '2026-10-01',
      })),
    )
    .run();
}

let plantilla: Buffer | null = null;
let plantillaVacia: Buffer | null = null;

export interface BaseDePrueba {
  readonly cliente: Database.Database;
  readonly db: BetterSQLite3Database;
  readonly libro: Libro;
}

/**
 * Abre una base en memoria ya migrada (y con el plan de cuentas de prueba salvo `vacia`). La primera
 * llamada migra una plantilla; las siguientes la copian con `serialize` para que cada prueba sea barata.
 */
export function abrirBase({ vacia = false }: { vacia?: boolean } = {}): BaseDePrueba {
  if (!plantilla || !plantillaVacia) {
    const cliente = new Database(':memory:');
    const db = drizzle({ client: cliente });
    migrar(db);
    plantillaVacia = cliente.serialize();
    sembrarPlan(db);
    plantilla = cliente.serialize();
    cliente.close();
  }
  const cliente = new Database(vacia ? plantillaVacia : plantilla);
  cliente.pragma('foreign_keys = ON');
  const db = drizzle({ client: cliente });
  let n = 0;
  let reloj = 1_790_000_000_000;
  const libro = new Libro(db, {
    generarId: () => `id-${String(++n).padStart(6, '0')}`,
    ahora: () => ++reloj,
  });
  return { cliente, db, libro };
}
