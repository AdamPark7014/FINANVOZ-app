/**
 * Tokens de diseño de Finanvoz (02-UX §15–§16): sobria, alto contraste, un solo acento,
 * modo oscuro desde v1, cifras tabulares. Colores de marca en `assets/marca/README.md`.
 *
 * Contrastes (WCAG AA, ≥ 4.5:1 para texto normal) calculados a mano para cada par
 * texto/fondo usado por los componentes; ver `tokens.test.ts`.
 */

export const marca = {
  claro: '#14A37F',
  acento: '#0E8A6E',
  oscuro: '#0A6B57',
  blanco: '#FFFFFF',
} as const;

export type EsquemaColor = 'claro' | 'oscuro';

export interface Colores {
  /** Fondo de pantalla. */
  fondo: string;
  /** Tarjetas, hojas y la barra de pestañas. */
  superficie: string;
  /** Superficie elevada o presionada. */
  superficieAlterna: string;
  /**
   * Borde decorativo de tarjetas y separadores (no identifica un control). ≥ 1.5:1 contra `superficie`
   * para distinguir la tarjeta; no entra en WCAG 1.4.11.
   */
  borde: string;
  /**
   * Borde de controles: campos sin foco, interruptor apagado y opciones sin elegir. ≥ 3:1 contra `fondo`,
   * `superficie` y `superficieAlterna` (WCAG 1.4.11, contraste de componentes; pase de M13).
   */
  bordeControl: string;
  /** Texto principal; ≥ 4.5:1 (AA) sobre `fondo`, `superficie` y `superficieAlterna`. */
  texto: string;
  /** Texto secundario y pestañas inactivas; ≥ 4.5:1 sobre `fondo`, `superficie` y `superficieAlterna`. */
  textoSecundario: string;
  /** Texto deshabilitado; solo para elementos inactivos (exentos de AA). */
  textoDeshabilitado: string;
  /**
   * El único color de acento: botones primarios, pestaña activa, interruptores. ≥ 3:1 contra `fondo`,
   * `superficie` y `superficieAlterna` (WCAG 1.4.11).
   */
  acento: string;
  /** Texto e íconos sobre `acento`; ≥ 4.5:1 (AA). */
  sobreAcento: string;
  /** Acento como texto sobre `fondo`, `superficie` o `superficieAlterna` (enlaces y botón de texto); ≥ 4.5:1. */
  acentoTexto: string;
  /**
   * Solo para el faltante (02-UX §14: "nunca en rojo salvo el faltante"). Siempre acompañado
   * de texto: ninguna información solo por color. ≥ 4.5:1 sobre `fondo`, `superficie` y `superficieAlterna`.
   */
  faltante: string;
  /** Fondo del aviso inferior (toast); contraste con `sobreAviso` y `avisoAccion`. */
  aviso: string;
  /** Texto del aviso; ≥ 4.5:1 sobre `aviso`. */
  sobreAviso: string;
  /** Acción dentro del aviso ("Deshacer"); ≥ 4.5:1 sobre `aviso`. */
  avisoAccion: string;
  /** Anillo de foco y de campo activo; ≥ 3:1 contra `fondo` y `superficie` (WCAG 1.4.11). */
  foco: string;
  /** Velo detrás de hojas y del bloqueo. */
  velo: string;
  /** Dock de voz (dirección B): verde pino al pie de Asistente, Movimientos y Cuentas. */
  dock: string;
  /** Botones laterales del dock («Escribir», «¿Me alcanza?», «Buscar», «Agregar»). */
  dockBoton: string;
  /** Texto e íconos sobre `dock` y `dockBoton`; ≥ 4.5:1 (AA). */
  sobreDock: string;
  /** El micrófono del dock (menta); ≥ 3:1 contra `dock` (WCAG 1.4.11). */
  microfono: string;
  /** Ícono sobre `microfono`; ≥ 4.5:1. */
  sobreMicrofono: string;
  /** Riel del selector Asistente · Movimientos · Cuentas. */
  segmento: string;
  /** Segmento elegido del selector (y el círculo de Tú sin elegir). */
  segmentoActivo: string;
  /** Cuadro del ícono de categoría o de cuenta; el ícono va en `acento` (≥ 3:1). */
  iconoFondo: string;
  /** Fondo de lo que pide atención sin ser error (frase por revisar). */
  atencion: string;
  /** Texto e ícono sobre `atencion`; ≥ 4.5:1. */
  sobreAtencion: string;
}

/**
 * Paleta de la dirección B «Plática» (`docs/diseno/direccion-b/B0-ficha.png`): Niebla, Tarjeta, Tinta, Pino, Menta y
 * Cifra en claro; en oscuro, el mismo pino y la menta sobre verdes casi negros. `acentoTexto` es la «Cifra» (la cifra
 * del día y los enlaces); `acento` es el pino de los botones y los chips elegidos.
 */
export const colores: Record<EsquemaColor, Colores> = {
  claro: {
    /** Niebla. */
    fondo: '#F3F5F1',
    superficie: '#FFFFFF',
    superficieAlterna: '#E5EBE6',
    borde: '#C9D1CC',
    bordeControl: '#7A8783',
    /** Tinta. */
    texto: '#12201B',
    textoSecundario: '#52605A',
    textoDeshabilitado: '#9AA5A1',
    /** Pino. */
    acento: '#0F3D32',
    sobreAcento: '#FFFFFF',
    /** Cifra. */
    acentoTexto: '#0B6B55',
    faltante: '#B3261E',
    aviso: '#12201B',
    sobreAviso: '#F3F5F1',
    avisoAccion: '#5EE0B0',
    foco: marca.acento,
    velo: 'rgba(0,0,0,0.45)',
    dock: '#0F3D32',
    dockBoton: '#1E5546',
    sobreDock: '#FFFFFF',
    /** Menta. */
    microfono: '#5EE0B0',
    sobreMicrofono: '#0F3D32',
    segmento: '#E2E8E3',
    segmentoActivo: '#FFFFFF',
    iconoFondo: '#E3F1EA',
    atencion: '#FFF0C7',
    sobreAtencion: '#5C4300',
  },
  oscuro: {
    fondo: '#0B1512',
    superficie: '#13201C',
    superficieAlterna: '#1C2A25',
    borde: '#3A4C45',
    bordeControl: '#6F7D79',
    texto: '#EAF2EE',
    textoSecundario: '#9DB0A8',
    textoDeshabilitado: '#5E6A66',
    acento: '#5EE0B0',
    sobreAcento: '#0B1512',
    acentoTexto: '#5EE0B0',
    faltante: '#FF8A80',
    aviso: '#E3EAE7',
    sobreAviso: '#12201B',
    avisoAccion: marca.oscuro,
    foco: '#5EE0B0',
    velo: 'rgba(0,0,0,0.6)',
    dock: '#1C3A31',
    dockBoton: '#2A5144',
    sobreDock: '#EAF2EE',
    microfono: '#5EE0B0',
    sobreMicrofono: '#0B1512',
    segmento: '#13201C',
    segmentoActivo: '#26392F',
    iconoFondo: '#1C3A31',
    atencion: '#3A3010',
    sobreAtencion: '#FFD970',
  },
};

/** Degradado de marca (bienvenida, ícono, bloqueo). */
export const degradadoMarca = [marca.claro, marca.oscuro] as const;

/**
 * Escala de espaciado en dp (base 4). En `gap` y `padding` de pantallas usa solo estos valores
 * (y `margenPantalla`); guía en `README.md` de esta carpeta.
 */
export const espacio = {
  xxs: 2,
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Margen lateral de pantalla (= `espacio.l`; escala completa en `README.md`). */
export const margenPantalla = espacio.l;

export const radio = {
  s: 8,
  m: 14,
  l: 20,
  /** Hojas, burbujas del asistente y tarjetas hero. */
  xl: 28,
  pastilla: 999,
} as const;

/**
 * Sombras suaves (iOS shadow* + Android elevation). Usar sobre `superficie` en modo claro;
 * en oscuro, elevación ligera sin halo verde.
 */
export const sombra = {
  tarjeta: {
    claro: {
      shadowColor: marca.oscuro,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 3,
    },
    oscuro: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 4,
    },
  },
  aviso: {
    claro: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 16,
      elevation: 6,
    },
    oscuro: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.45,
      shadowRadius: 12,
      elevation: 8,
    },
  },
} as const;

/** Objetivo táctil mínimo (02-UX §15, RNF-08). */
export const OBJETIVO_TACTIL_MIN = 48;

/** Amplía el área táctil cuando el control visible mide menos de 48 dp. */
export const hitSlopTactil = {
  top: espacio.s,
  bottom: espacio.s,
  left: espacio.s,
  right: espacio.s,
} as const;

/**
 * Duración mínima del aviso con "Deshacer" (02-UX §1.3, RF-REG-04). Android puede pedir más (ajuste "Tiempo
 * para actuar" de accesibilidad) y con lector de pantalla no se cierra solo.
 */
export const DURACION_AVISO_MS = 10_000;

/**
 * Escala tipográfica. Tamaños en sp: escalan con la preferencia del sistema (texto al 200 %);
 * por eso ningún componente fija alto ni corta líneas de cifras.
 */
export const tipo = {
  cifraHeroe: { fontSize: 48, lineHeight: 58, fontWeight: '700' as const, letterSpacing: -0.5 },
  cifraGrande: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.3 },
  titulo: { fontSize: 24, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.2 },
  subtitulo: { fontSize: 18, lineHeight: 28, fontWeight: '600' as const },
  cuerpo: { fontSize: 16, lineHeight: 26, fontWeight: '400' as const },
  cuerpoFuerte: { fontSize: 16, lineHeight: 26, fontWeight: '600' as const },
  secundario: { fontSize: 14, lineHeight: 22, fontWeight: '400' as const },
  etiqueta: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  pequeno: { fontSize: 12, lineHeight: 18, fontWeight: '400' as const },
} as const;

export type VarianteTexto = keyof typeof tipo;

/** Las cifras usan números tabulares para que no "bailen" al cambiar (02-UX §16). */
export const NUMEROS_TABULARES = ['tabular-nums'] as const;

/**
 * Navegación de arriba (dirección B, `02 §2`): el selector Asistente · Movimientos · Cuentas y el círculo de Tú. La
 * ruta del asistente sigue siendo `hoy` (enlaces, widget y Maestro); Tú no es segmento: la abre el círculo.
 */
export const navegacionSuperior = {
  segmentos: [
    { ruta: 'hoy', etiqueta: 'Asistente' },
    { ruta: 'movimientos', etiqueta: 'Movimientos' },
    { ruta: 'cuentas', etiqueta: 'Cuentas' },
  ],
  tu: { ruta: 'tu', etiqueta: 'Tú' },
  /** Alto del selector y diámetro del círculo de Tú (B1: 48). */
  alto: 48,
  /** Separación del selector con la barra de estado (B1: 52 − 44 del área segura ≈ 8). */
  margenSuperior: espacio.s,
  etiqueta: { fontSize: 15, lineHeight: 20 },
} as const;

/** Medidas del dock de voz (B1: 84 de alto, radio 32, botones de 118 × 52 y micrófono de 68). */
export const dockVoz = {
  alto: 84,
  radio: 32,
  margenLateral: espacio.m,
  anchoBoton: 118,
  altoBoton: 52,
  microfono: 68,
  /** Anillo de 6 alrededor del micrófono. */
  anillo: 6,
  etiqueta: { fontSize: 15, lineHeight: 20, fontWeight: '700' as const },
} as const;
