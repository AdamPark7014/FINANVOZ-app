/**
 * Puente tipado al módulo nativo de captura de Android (`modules/captura-android`,
 * `docs/07-CAPTURA.md §2.3`, `docs/03-ARQUITECTURA.md §5.2`).
 *
 * Si el módulo no existe (Jest, Expo Go, iOS, web), todo degrada sin lanzar: la cola está
 * vacía, el permiso es `'no_disponible'`, no hay apps ni eventos.
 *
 * Nada de aquí escribe en logs: las notificaciones traen montos y comercios (regla 9).
 */
import { z } from 'zod';
import { cargarModuloNativo } from './puente-nativo';

/** Notificación tal como la deja el servicio en la cola (`03 §5.2`). */
export interface NotificacionCruda {
  /** `sbn.key`. */
  clave: string;
  /** `sbn.tag`; en depuración, la etiqueta de `adb` (`banco_a`…). */
  etiqueta: string | null;
  /** Paquete de la app de banco (en depuración, el del banco de la etiqueta de `adb`). */
  paquete: string;
  /** `EXTRA_TITLE`, `''` si falta. */
  titulo: string;
  /** `EXTRA_BIG_TEXT` o, si no hay, `EXTRA_TEXT`; `''` si faltan. */
  texto: string;
  /** `sbn.postTime`, ms desde época. */
  publicada_en: number;
  /** `notification.when` si es mayor que 0; si no, `postTime` (`07 §2.4`). */
  cuando: number;
}

export type EstadoPermiso = 'concedido' | 'denegado' | 'no_disponible';

/** App de banco del catálogo embebido que está instalada. */
export interface AppBancaria {
  /** Id del banco en el catálogo (`bbva_mx`, `nu_mx`…; en depuración `banco_a`…). */
  banco: string;
  nombre: string;
  paquete: string;
}

export interface EstadoServicio {
  conectado_en: number | null;
  desconectado_en: number | null;
  ultimo_evento: number | null;
}

export interface ConteosPaquete {
  recibidas?: number;
  encoladas?: number;
  repetidas?: number;
  resumen_grupo?: number;
  en_curso?: number;
  con_titulo?: number;
  con_texto_grande?: number;
  con_texto?: number;
  sin_contenido?: number;
  /** Rangos de largo del texto ("0", "1-80", "81-160", "161-320", "321+"). */
  largo_texto?: Record<string, number>;
  /** Extras `android.*` presentes (solo nombres). */
  extras?: Record<string, number>;
}

/** Resumen del modo diagnóstico (spike S2): solo paquetes autorizados y conteos, nunca texto. */
export interface ResumenDiagnostico {
  activo: boolean;
  muestras: boolean;
  /** Solo los builds de depuración permiten guardar muestras de texto. */
  permite_muestras: boolean;
  desde: number | null;
  /** Notificaciones de apps no autorizadas: solo el total, sin paquete. */
  no_autorizadas: number;
  paquetes: Record<string, ConteosPaquete>;
}

/** Muestra de texto (solo depuración y con consentimiento explícito) para anonimizar a mano. */
export interface MuestraDiagnostico {
  paquete: string;
  etiqueta: string | null;
  titulo: string;
  texto: string;
  cuando: number;
}

interface Suscripcion {
  remove(): void;
}

/** Forma del módulo nativo `CapturaAndroid` (`CapturaModule.kt`). */
export interface ModuloCapturaNativo {
  readonly depuracion?: boolean;
  leerCola(): Promise<unknown[]>;
  confirmarProcesadas(procesadas: NotificacionCruda[]): Promise<number>;
  estadoPermiso(): Promise<string>;
  abrirAjustesPermiso(): Promise<boolean>;
  abrirInfoApp(): Promise<boolean>;
  appsBancariasInstaladas(): Promise<unknown[]>;
  fijarListaBlanca(paquetes: string[]): Promise<string[]>;
  listaBlanca(): Promise<string[]>;
  ultimoEvento(): Promise<number | null>;
  estadoServicio(): Promise<unknown>;
  solicitarReconexion(): Promise<void>;
  diagnosticoResumen(): Promise<unknown>;
  diagnosticoConfigurar(activo: boolean, muestras: boolean): Promise<unknown>;
  diagnosticoMuestras(): Promise<unknown[]>;
  diagnosticoBorrar(): Promise<void>;
  /** M10 (`07 §3.1`): bancos de las plantillas remotas verificadas, `{bancos}` en JSON; `null` las quita. */
  fijarCatalogoRemoto?(json: string | null): Promise<number>;
  /** M15 (`07 §8`): texto de cada página de un PDF (URI compartida o de la caché del selector). */
  extraerTextoPdf?(uri: string, contrasena: string | null): Promise<unknown>;
  addListener(evento: 'notificacion', oyente: (n: unknown) => void): Suscripcion;
}

const instante = z.number().int().nonnegative();
const nulo = <T extends z.ZodType>(t: T) => t.nullish().transform((v) => v ?? null);

const esquemaNotificacion = z.object({
  clave: z.string().min(1),
  etiqueta: nulo(z.string()),
  paquete: z.string().min(1),
  titulo: z.string(),
  texto: z.string(),
  publicada_en: instante,
  cuando: instante,
});

const esquemaApp = z.object({ banco: z.string(), nombre: z.string(), paquete: z.string() });

const esquemaEstadoServicio = z.object({
  conectado_en: nulo(instante),
  desconectado_en: nulo(instante),
  ultimo_evento: nulo(instante),
});

const conteo = z.number().int().nonnegative();
const esquemaResumen = z.object({
  activo: z.boolean(),
  muestras: z.boolean(),
  permite_muestras: z.boolean(),
  desde: nulo(instante),
  no_autorizadas: conteo,
  paquetes: z.record(
    z.string(),
    z
      .object({
        largo_texto: z.record(z.string(), conteo).optional(),
        extras: z.record(z.string(), conteo).optional(),
      })
      .catchall(conteo),
  ),
});

const esquemaMuestra = z.object({
  paquete: z.string(),
  etiqueta: nulo(z.string()),
  titulo: z.string(),
  texto: z.string(),
  cuando: instante,
});

/** Normaliza una notificación del módulo; `null` si no tiene la forma esperada. */
export function aNotificacionCruda(valor: unknown): NotificacionCruda | null {
  const r = esquemaNotificacion.safeParse(valor);
  return r.success ? r.data : null;
}

function filtrar<T>(valores: readonly unknown[], esquema: z.ZodType<T>): T[] {
  const salida: T[] = [];
  for (const v of valores) {
    const r = esquema.safeParse(v);
    if (r.success) salida.push(r.data);
  }
  return salida;
}

/** Solo los siete campos, sin propiedades extra que el puente nativo no espera. */
function soloCampos(n: NotificacionCruda): NotificacionCruda {
  return {
    clave: n.clave,
    etiqueta: n.etiqueta,
    paquete: n.paquete,
    titulo: n.titulo,
    texto: n.texto,
    publicada_en: n.publicada_en,
    cuando: n.cuando,
  };
}

/**
 * Texto de un estado de cuenta en PDF, extraído en el teléfono (`EstadoCuentaPdf.kt`). `no_disponible` sin el
 * módulo (Jest, Expo Go, iOS) o con un build anterior a M15.
 */
export type ResultadoExtraccionPdf =
  | { readonly tipo: 'texto'; readonly paginas: readonly string[] }
  | { readonly tipo: 'pide_contrasena' }
  | { readonly tipo: 'contrasena_incorrecta' }
  | { readonly tipo: 'invalido' }
  | { readonly tipo: 'demasiado_grande' }
  | { readonly tipo: 'no_disponible' };

const esquemaExtraccionPdf = z.discriminatedUnion('resultado', [
  z.object({ resultado: z.literal('texto'), paginas: z.array(z.string()) }),
  z.object({ resultado: z.literal('pide_contrasena') }),
  z.object({ resultado: z.literal('contrasena_incorrecta') }),
  z.object({ resultado: z.literal('invalido') }),
  z.object({ resultado: z.literal('demasiado_grande') }),
]);

const DIAGNOSTICO_VACIO: ResumenDiagnostico = {
  activo: false,
  muestras: false,
  permite_muestras: false,
  desde: null,
  no_autorizadas: 0,
  paquetes: {},
};

export interface PuenteCaptura {
  /** `true` si el módulo nativo existe (build de Android con el plugin). */
  disponible(): boolean;
  /** `true` en builds de depuración (acepta `adb` con etiqueta de banco y permite muestras). */
  esDepuracion(): boolean;
  /** Pendientes de ingerir, en orden de llegada. Las entradas con forma inválida se omiten. */
  leerCola(): Promise<NotificacionCruda[]>;
  /**
   * Quita de la cola las notificaciones ya ingeridas. Se identifican por todos sus campos
   * (los de la huella), no solo por `clave`: un banco puede reutilizar `sbn.key` y una
   * notificación que llegó después de `leerCola()` no debe borrarse. Pasa los objetos tal como
   * los devolvió `leerCola()` o el evento. Devuelve cuántas quitó.
   */
  confirmarProcesadas(procesadas: readonly NotificacionCruda[]): Promise<number>;
  /**
   * Avisa cada notificación encolada mientras la app está viva. La cola sigue siendo la fuente
   * de verdad: confirma con `confirmarProcesadas` lo que ingieras. Devuelve la función para
   * cancelar.
   */
  suscribirse(oyente: (n: NotificacionCruda) => void): () => void;
  estadoPermiso(): Promise<EstadoPermiso>;
  /** Abre el ajuste de acceso a notificaciones. `false` si no se pudo abrir. */
  abrirAjustesPermiso(): Promise<boolean>;
  /** Abre Información de la app ("Permitir ajustes restringidos", Android 13+ fuera de Play). */
  abrirInfoApp(): Promise<boolean>;
  /** Apps del catálogo de bancos instaladas en el teléfono. */
  appsBancariasInstaladas(): Promise<AppBancaria[]>;
  /** Guarda las apps que el usuario marcó; devuelve las que quedaron (solo del catálogo). */
  fijarListaBlanca(paquetes: readonly string[]): Promise<string[]>;
  listaBlanca(): Promise<string[]>;
  /** Instante (ms) de la última notificación vista de una app autorizada (RF-CAP-07). */
  ultimoEvento(): Promise<number | null>;
  estadoServicio(): Promise<EstadoServicio>;
  /** Pide al sistema reconectar el servicio (`requestRebind`). */
  solicitarReconexion(): Promise<void>;
  /**
   * Pasa al módulo nativo los bancos de las plantillas remotas ya verificadas (`07 §3.1`): ganan por id sobre
   * el catálogo embebido, así un banco o paquete nuevo puede entrar a la lista blanca sin publicar la app.
   * `null` vuelve al embebido. `false` sin módulo o con un build anterior a M10.
   */
  fijarCatalogoRemoto(bancos: readonly unknown[] | null): Promise<boolean>;
  /**
   * Extrae en el teléfono el texto de un PDF (`07 §8`): nada sale del teléfono. Un error del módulo o una
   * respuesta con otra forma cuenta como `invalido`. La contraseña no se guarda.
   */
  extraerTextoPdf(uri: string, contrasena?: string | null): Promise<ResultadoExtraccionPdf>;
  diagnostico: {
    resumen(): Promise<ResumenDiagnostico>;
    /** `muestras: true` solo funciona en builds de depuración; en otros lanza. */
    configurar(opciones: { activo: boolean; muestras?: boolean }): Promise<ResumenDiagnostico>;
    muestras(): Promise<MuestraDiagnostico[]>;
    borrar(): Promise<void>;
  };
}

/** Crea el puente sobre un cargador del módulo (inyectable para pruebas). */
export function crearPuente(cargar: () => ModuloCapturaNativo | null): PuenteCaptura {
  let cache: ModuloCapturaNativo | null | undefined;
  const modulo = (): ModuloCapturaNativo | null => {
    if (cache === undefined) cache = cargar();
    return cache;
  };

  const resumen = (v: unknown): ResumenDiagnostico => {
    const r = esquemaResumen.safeParse(v);
    return r.success ? (r.data as ResumenDiagnostico) : DIAGNOSTICO_VACIO;
  };

  return {
    disponible: () => modulo() !== null,
    esDepuracion: () => modulo()?.depuracion === true,

    async leerCola() {
      const m = modulo();
      if (!m) return [];
      return filtrar(await m.leerCola(), esquemaNotificacion);
    },

    async confirmarProcesadas(procesadas) {
      const m = modulo();
      if (!m || procesadas.length === 0) return 0;
      return m.confirmarProcesadas(procesadas.map(soloCampos));
    },

    suscribirse(oyente) {
      const m = modulo();
      if (!m) return () => {};
      const s = m.addListener('notificacion', (valor) => {
        const n = aNotificacionCruda(valor);
        if (n) oyente(n);
      });
      return () => s.remove();
    },

    async estadoPermiso() {
      const m = modulo();
      if (!m) return 'no_disponible';
      return (await m.estadoPermiso()) === 'concedido' ? 'concedido' : 'denegado';
    },

    async abrirAjustesPermiso() {
      const m = modulo();
      return m ? m.abrirAjustesPermiso() : false;
    },

    async abrirInfoApp() {
      const m = modulo();
      return m ? m.abrirInfoApp() : false;
    },

    async appsBancariasInstaladas() {
      const m = modulo();
      if (!m) return [];
      return filtrar(await m.appsBancariasInstaladas(), esquemaApp);
    },

    async fijarListaBlanca(paquetes) {
      const m = modulo();
      if (!m) return [];
      return m.fijarListaBlanca([...new Set(paquetes)]);
    },

    async listaBlanca() {
      const m = modulo();
      return m ? m.listaBlanca() : [];
    },

    async ultimoEvento() {
      const m = modulo();
      if (!m) return null;
      const v = await m.ultimoEvento();
      return instante.safeParse(v).success ? v : null;
    },

    async estadoServicio() {
      const m = modulo();
      const vacio = { conectado_en: null, desconectado_en: null, ultimo_evento: null };
      if (!m) return vacio;
      const r = esquemaEstadoServicio.safeParse(await m.estadoServicio());
      return r.success ? r.data : vacio;
    },

    async solicitarReconexion() {
      await modulo()?.solicitarReconexion();
    },

    async fijarCatalogoRemoto(bancos) {
      const m = modulo();
      if (!m || typeof m.fijarCatalogoRemoto !== 'function') return false;
      await m.fijarCatalogoRemoto(bancos === null ? null : JSON.stringify({ bancos }));
      return true;
    },

    async extraerTextoPdf(uri, contrasena = null) {
      const m = modulo();
      if (!m || typeof m.extraerTextoPdf !== 'function') return { tipo: 'no_disponible' };
      let crudo: unknown;
      try {
        crudo = await m.extraerTextoPdf(uri, contrasena === '' ? null : contrasena);
      } catch {
        return { tipo: 'invalido' };
      }
      const r = esquemaExtraccionPdf.safeParse(crudo);
      if (!r.success) return { tipo: 'invalido' };
      return r.data.resultado === 'texto'
        ? { tipo: 'texto', paginas: r.data.paginas }
        : { tipo: r.data.resultado };
    },

    diagnostico: {
      async resumen() {
        const m = modulo();
        return m ? resumen(await m.diagnosticoResumen()) : DIAGNOSTICO_VACIO;
      },
      async configurar({ activo, muestras = false }) {
        const m = modulo();
        if (!m) return DIAGNOSTICO_VACIO;
        return resumen(await m.diagnosticoConfigurar(activo, muestras));
      },
      async muestras() {
        const m = modulo();
        return m ? filtrar(await m.diagnosticoMuestras(), esquemaMuestra) : [];
      },
      async borrar() {
        await modulo()?.diagnosticoBorrar();
      },
    },
  };
}

/** Puente sobre el módulo real (o degradado si no existe). */
export const puenteCaptura: PuenteCaptura = crearPuente(cargarModuloNativo);

export const leerCola = () => puenteCaptura.leerCola();
export const confirmarProcesadas = (procesadas: readonly NotificacionCruda[]) =>
  puenteCaptura.confirmarProcesadas(procesadas);
export const suscribirse = (oyente: (n: NotificacionCruda) => void) => puenteCaptura.suscribirse(oyente);
export const estadoPermiso = () => puenteCaptura.estadoPermiso();
export const abrirAjustesPermiso = () => puenteCaptura.abrirAjustesPermiso();
export const abrirInfoApp = () => puenteCaptura.abrirInfoApp();
export const appsBancariasInstaladas = () => puenteCaptura.appsBancariasInstaladas();
export const fijarListaBlanca = (paquetes: readonly string[]) => puenteCaptura.fijarListaBlanca(paquetes);
export const listaBlanca = () => puenteCaptura.listaBlanca();
export const ultimoEvento = () => puenteCaptura.ultimoEvento();
export const estadoServicio = () => puenteCaptura.estadoServicio();
export const solicitarReconexion = () => puenteCaptura.solicitarReconexion();
export const capturaDisponible = () => puenteCaptura.disponible();
export const extraerTextoPdf = (uri: string, contrasena?: string | null) =>
  puenteCaptura.extraerTextoPdf(uri, contrasena);
