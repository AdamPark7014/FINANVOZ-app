/**
 * Contrato con el módulo nativo de captura (`modules/captura-android`, `07 §2.3`, `03 §5.2`). La ingesta y las
 * pantallas dependen solo de este puerto: sin el módulo (Expo Go, pruebas, iPhone) la app funciona igual y la
 * captura aparece como no disponible. `puente.ts` (del módulo nativo) implementa esta forma.
 */

/** Una notificación tal como la deja el servicio nativo en la cola (`03 §5.2`). */
export interface NotificacionCruda {
  /** `sbn.key` */
  readonly clave: string;
  /** `sbn.tag`: en builds de depuración, el `id` del banco al publicar con `adb` (`07 §2.5`). */
  readonly etiqueta: string | null;
  readonly paquete: string;
  readonly titulo: string | null;
  readonly texto: string | null;
  /** `sbn.postTime` en ms UTC. */
  readonly publicada_en: number;
  /** `notification.when` en ms UTC (0 o negativo si la app no lo puso). */
  readonly cuando: number;
}

export type EstadoPermisoCaptura = 'concedido' | 'denegado';

/** Suscripción a eventos del servicio; se cancela con `remove()`. */
export interface SuscripcionCaptura {
  remove(): void;
}

/** Puerto del módulo nativo. Los métodos opcionales pueden no existir en versiones viejas del módulo. */
export interface PuenteCaptura {
  leerCola(): Promise<readonly NotificacionCruda[]>;
  /** Borra de la cola nativa lo ya ingerido. */
  confirmarProcesadas(claves: readonly string[]): Promise<void>;
  suscribirse(fn: (n: NotificacionCruda) => void): SuscripcionCaptura;
  estadoPermiso(): Promise<EstadoPermisoCaptura>;
  abrirAjustesPermiso(): void;
  /** Paquetes de apps bancarias conocidas instaladas en el teléfono (`<queries>` del manifiesto). */
  appsBancariasInstaladas(): Promise<readonly string[]>;
  /** Último evento del servicio en ms UTC (`null` si nunca), para detectar captura inactiva (RF-CAP-07). */
  ultimoEvento(): Promise<number | null>;
  /** Lista blanca en el código nativo (RF-CAP-02). */
  fijarListaBlanca?(paquetes: readonly string[]): Promise<void>;
}

/** SHA-256 en hexadecimal (expo-crypto en la app, node:crypto en pruebas). */
export type Sha256Hex = (texto: string) => Promise<string>;
