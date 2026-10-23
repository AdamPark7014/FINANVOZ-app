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
}

export const colores: Record<EsquemaColor, Colores> = {
  claro: {
    fondo: '#F7F9F8',
    superficie: '#FFFFFF',
    superficieAlterna: '#EDF2F0',
    borde: '#C9D3CF',
    bordeControl: '#7A8783',
    texto: '#111816',
    textoSecundario: '#4A5652',
    textoDeshabilitado: '#9AA5A1',
    acento: marca.oscuro,
    sobreAcento: '#FFFFFF',
    acentoTexto: marca.oscuro,
    faltante: '#B3261E',
    aviso: '#1B2421',
    sobreAviso: '#F2F5F4',
    avisoAccion: '#5FD3B0',
    foco: marca.acento,
    velo: 'rgba(0,0,0,0.45)',
  },
  oscuro: {
    fondo: '#0E1312',
    superficie: '#171E1C',
    superficieAlterna: '#212A27',
    borde: '#3A4643',
    bordeControl: '#6F7D79',
    texto: '#ECF1EF',
    textoSecundario: '#A9B5B1',
    textoDeshabilitado: '#5E6A66',
    acento: marca.claro,
    sobreAcento: '#04140F',
    acentoTexto: '#3FC79F',
    faltante: '#FF8A80',
    aviso: '#E3EAE7',
    sobreAviso: '#111816',
    avisoAccion: marca.oscuro,
    foco: '#3FC79F',
    velo: 'rgba(0,0,0,0.6)',
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
  s: 6,
  m: 10,
  l: 16,
  pastilla: 999,
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
  cifraHeroe: { fontSize: 48, lineHeight: 56, fontWeight: '700' },
  cifraGrande: { fontSize: 32, lineHeight: 40, fontWeight: '700' },
  titulo: { fontSize: 24, lineHeight: 32, fontWeight: '700' },
  subtitulo: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
  cuerpo: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  cuerpoFuerte: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  secundario: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  etiqueta: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  pequeno: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
} as const;

export type VarianteTexto = keyof typeof tipo;

/** Las cifras usan números tabulares para que no "bailen" al cambiar (02-UX §16). */
export const NUMEROS_TABULARES = ['tabular-nums'] as const;

/**
 * Tokens de la barra de pestañas (Ola 7 §2): Asistente · Movimientos · Cuentas · Tú. La ruta del asistente sigue
 * siendo `hoy` (enlaces, widget y Maestro).
 */
export const barraPestanas = {
  pestanas: [
    { ruta: 'hoy', etiqueta: 'Asistente' },
    { ruta: 'movimientos', etiqueta: 'Movimientos' },
    { ruta: 'cuentas', etiqueta: 'Cuentas' },
    { ruta: 'tu', etiqueta: 'Tú' },
  ],
  alto: 64,
  tamanoIcono: 24,
  etiqueta: tipo.pequeno,
} as const;

/**
 * Opciones de estilo para `<Tabs screenOptions>` de Expo Router, sin importar Expo Router aquí.
 * La etiqueta siempre visible: la pestaña activa no se distingue solo por color.
 */
export function estiloBarraPestanas(c: Colores) {
  return {
    tabBarActiveTintColor: c.acentoTexto,
    tabBarInactiveTintColor: c.textoSecundario,
    tabBarShowLabel: true,
    tabBarStyle: {
      backgroundColor: c.superficie,
      borderTopColor: c.borde,
      minHeight: barraPestanas.alto,
    },
    tabBarLabelStyle: { fontSize: barraPestanas.etiqueta.fontSize, fontWeight: '600' as const },
    tabBarItemStyle: { minHeight: OBJETIVO_TACTIL_MIN },
  };
}
