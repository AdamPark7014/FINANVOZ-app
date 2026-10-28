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
  /** Segmento elegido del selector (el círculo de Tú va en `superficie`, como en B1 y B6). */
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

// ——— Dirección B+ «Viva» (`docs/diseno/direccion-b-plus/`, D0) ———

/**
 * Familias de color de las categorías (D0): cada gasto lleva un mosaico claro con su ícono oscuro, y su color de barra
 * en «En qué se fue». Las seis primeras son las del tablero; `otros` (gris) es nuestra para lo que no cae en ellas.
 */
export type FamiliaCategoria =
  'antojos' | 'comidaFuera' | 'super' | 'transporte' | 'salidas' | 'casa' | 'otros';

export interface PaletaCategoria {
  /** Fondo del cuadro del ícono. */
  readonly mosaico: string;
  /** Ícono sobre `mosaico`; ≥ 4.5:1 (más que el 3:1 que pide WCAG 1.4.11 a un gráfico). */
  readonly icono: string;
  /** Segmento de la barra y punto de la leyenda (la leyenda dice nombre y cifra: el color nunca va solo). */
  readonly barra: string;
}

/**
 * Colores exactos de `direccion-b-plus/README.md` en claro. En oscuro (sin tablero): mosaico casi negro teñido del
 * mismo tono, ícono claro y la misma barra, salvo Casa, cuyo pino desaparecería sobre la tarjeta oscura.
 */
export const coloresCategoria: Record<EsquemaColor, Record<FamiliaCategoria, PaletaCategoria>> = {
  claro: {
    antojos: { mosaico: '#FFF0D1', icono: '#7A4F00', barra: '#F2B33D' },
    comidaFuera: { mosaico: '#FFE4DB', icono: '#9C3417', barra: '#EE7650' },
    super: { mosaico: '#DDF5EA', icono: '#0B5E45', barra: '#2FB386' },
    transporte: { mosaico: '#E1EBFF', icono: '#224C9E', barra: '#5B8DEF' },
    salidas: { mosaico: '#EDE5FF', icono: '#5533A8', barra: '#9B7BF0' },
    casa: { mosaico: '#E6ECE8', icono: '#0F3D32', barra: '#0F3D32' },
    otros: { mosaico: '#EEEFEC', icono: '#4B5652', barra: '#A9B3AE' },
  },
  oscuro: {
    antojos: { mosaico: '#3A2C0C', icono: '#FFD27A', barra: '#F2B33D' },
    comidaFuera: { mosaico: '#40211A', icono: '#FFB199', barra: '#EE7650' },
    super: { mosaico: '#0F3A2B', icono: '#7FE6BC', barra: '#2FB386' },
    transporte: { mosaico: '#17284A', icono: '#ADC6FF', barra: '#5B8DEF' },
    salidas: { mosaico: '#2A1F4A', icono: '#CDB9FF', barra: '#9B7BF0' },
    casa: { mosaico: '#1C2E28', icono: '#B9D3C8', barra: '#5F9C88' },
    otros: { mosaico: '#252B29', icono: '#C3CCC8', barra: '#7D8984' },
  },
};

/** A qué familia de color va cada categoría del catálogo (`04 §2.3`); las que no están, a `otros`. */
const FAMILIA_DE_CATEGORIA: Readonly<Record<string, FamiliaCategoria>> = {
  antojos: 'antojos',
  regalos: 'antojos',
  regalo_recibido: 'antojos',
  comida_fuera: 'comidaFuera',
  mascotas: 'comidaFuera',
  super: 'super',
  salud: 'super',
  cuidado_personal: 'super',
  sueldo: 'super',
  honorarios: 'super',
  ventas: 'super',
  reembolso: 'super',
  rendimientos: 'super',
  otros_ingresos: 'super',
  transporte: 'transporte',
  gasolina: 'transporte',
  viajes: 'transporte',
  tecnologia: 'transporte',
  entretenimiento: 'salidas',
  deporte: 'salidas',
  ropa: 'salidas',
  suscripciones: 'salidas',
  educacion: 'salidas',
  vivienda: 'casa',
  hogar: 'casa',
  servicios: 'casa',
  apoyo_familiar: 'casa',
};

export function familiaDeCategoria(slug: string | null | undefined): FamiliaCategoria {
  return (slug ? FAMILIA_DE_CATEGORIA[slug] : undefined) ?? 'otros';
}

/**
 * La barra de tu dinero (D1, D7) y «Cómo lo calculé» de una compra (D4): apartado · colchón · libre, y la compra en
 * coral. La leyenda nombra cada parte con su cifra.
 */
export interface ColoresDinero {
  readonly apartado: string;
  readonly colchon: string;
  readonly libre: string;
  readonly compra: string;
  /** Lo que se recorta de la barra del día al registrar (D3). */
  readonly recorte: string;
}

export const coloresDinero: Record<EsquemaColor, ColoresDinero> = {
  claro: { apartado: '#0F3D32', colchon: '#9CC5B5', libre: '#5EE0B0', compra: '#EE7650', recorte: '#FFC9BC' },
  oscuro: {
    apartado: '#3E7D6B',
    colchon: '#8FB3A6',
    libre: '#5EE0B0',
    compra: '#EE7650',
    recorte: '#7A3B2C',
  },
};

/** Tus cuentas como tarjetas (D6): efectivo menta, débito azul, crédito violeta; sin logotipos de bancos. */
export type ClaseCuenta = 'efectivo' | 'debito' | 'credito';

export interface ColoresCuenta {
  readonly fondo: string;
  /** Nombre y cifra; ≥ 4.5:1 sobre `fondo`. */
  readonly texto: string;
  /** El renglón de abajo («Lo contaste el vie 23»); ≥ 4.5:1 sobre `fondo`. */
  readonly textoSecundario: string;
  /** Los círculos decorativos de la esquina. */
  readonly adorno: string;
  /** Anillo de uso, mosaico e ícono del crédito fuera de su tarjeta (sobre `superficie`); ≥ 3:1. */
  readonly acento: string;
}

export const coloresCuenta: Record<EsquemaColor, Record<ClaseCuenta, ColoresCuenta>> = {
  claro: {
    efectivo: {
      fondo: '#5EE0B0',
      texto: '#0F3D32',
      textoSecundario: '#1E5546',
      adorno: '#4CCFA0',
      acento: '#0B6B55',
    },
    debito: {
      fondo: '#1D3B6F',
      texto: '#FFFFFF',
      textoSecundario: '#C9D6F0',
      adorno: '#2D4C82',
      acento: '#224C9E',
    },
    credito: {
      fondo: '#5B2A86',
      texto: '#FFFFFF',
      textoSecundario: '#E3D3F2',
      adorno: '#6C3B98',
      acento: '#7C4DB8',
    },
  },
  oscuro: {
    efectivo: {
      fondo: '#5EE0B0',
      texto: '#0F3D32',
      textoSecundario: '#1E5546',
      adorno: '#4CCFA0',
      acento: '#5EE0B0',
    },
    debito: {
      fondo: '#1D3B6F',
      // En oscuro, sin blanco puro (`02 §16`: nada blanco en oscuro).
      texto: '#F2F6FF',
      textoSecundario: '#C9D6F0',
      adorno: '#2D4C82',
      acento: '#8FB0F5',
    },
    credito: {
      fondo: '#5B2A86',
      texto: '#F8F2FF',
      textoSecundario: '#E3D3F2',
      adorno: '#6C3B98',
      acento: '#B79CE8',
    },
  },
};

/** «Te escucho» (D2): pantalla completa verde pino mientras escucha. */
export interface ColoresEscucha {
  readonly fondo: string;
  /** La frase en vivo y los botones; ≥ 4.5:1 sobre `fondo`. */
  readonly texto: string;
  /** «Voy entendiendo» y la pista de abajo; ≥ 4.5:1 sobre `fondo`. */
  readonly textoSecundario: string;
  /** Chips de lo que se va entendiendo y la píldora «Te escucho». */
  readonly chip: string;
  /** El chip ya seguro (la cifra) en menta, con su texto en pino. */
  readonly chipListo: string;
  readonly sobreChipListo: string;
  /** Filo del chip que todavía no termina («Efectivo …»); ≥ 3:1 sobre `fondo`. */
  readonly filoTentativo: string;
}

export const coloresEscucha: Record<EsquemaColor, ColoresEscucha> = {
  claro: {
    fondo: '#0F3D32',
    texto: '#FFFFFF',
    textoSecundario: '#A8CFC0',
    chip: '#1E5546',
    chipListo: '#5EE0B0',
    sobreChipListo: '#0F3D32',
    filoTentativo: '#8FB3A6',
  },
  oscuro: {
    fondo: '#0E2B23',
    texto: '#EAF2EE',
    textoSecundario: '#A8CFC0',
    chip: '#1C4136',
    chipListo: '#5EE0B0',
    sobreChipListo: '#0B1512',
    filoTentativo: '#8FB3A6',
  },
};

/**
 * El orbe (D0): menta con una sombra interior abajo a la derecha y un halo. Respira en reposo (escala del halo 1 →
 * 1.22 en 3.2 s) y lanza ondas al escuchar; quieto con «Reducir movimiento».
 */
export const orbe = {
  nucleo: '#5EE0B0',
  sombra: '#3FC895',
  halo: '#5EE0B0',
  /** Opacidad del halo en claro y en oscuro. */
  opacidadHalo: { claro: 0.3, oscuro: 0.22 },
  escalaRespiro: 1.22,
  cicloRespiroMs: 3200,
  cicloOndaMs: 1800,
} as const;

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
 * Familia de la dirección B (B0: Figtree 400–800). Va enlazada en la build con el plugin `expo-font` de `app.json`
 * (`assets/fuentes`, licencia OFL): en iOS la familia sale del archivo y en Android es una familia XML con sus
 * pesos, así que basta `fontFamily` + `fontWeight`. Un `Text` no hereda la familia de otro que no lo contenga:
 * todo estilo de texto la lleva, por eso vive en `tipo` y en las etiquetas de abajo.
 */
export const FUENTE = 'Figtree';

/**
 * Escala tipográfica. Tamaños en sp: escalan con la preferencia del sistema (texto al 200 %);
 * por eso ningún componente fija alto ni corta líneas de cifras.
 */
export const tipo = {
  cifraHeroe: {
    fontFamily: FUENTE,
    fontSize: 48,
    lineHeight: 58,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  cifraGrande: {
    fontFamily: FUENTE,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  titulo: {
    fontFamily: FUENTE,
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  subtitulo: { fontFamily: FUENTE, fontSize: 18, lineHeight: 28, fontWeight: '600' as const },
  /** Lo que dice el asistente (dirección B): texto grande, sin burbuja. */
  voz: { fontFamily: FUENTE, fontSize: 20, lineHeight: 28, fontWeight: '500' as const },
  cuerpo: { fontFamily: FUENTE, fontSize: 16, lineHeight: 26, fontWeight: '400' as const },
  cuerpoFuerte: { fontFamily: FUENTE, fontSize: 16, lineHeight: 26, fontWeight: '600' as const },
  secundario: { fontFamily: FUENTE, fontSize: 14, lineHeight: 22, fontWeight: '400' as const },
  etiqueta: { fontFamily: FUENTE, fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  pequeno: { fontFamily: FUENTE, fontSize: 12, lineHeight: 18, fontWeight: '400' as const },
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
  etiqueta: { fontFamily: FUENTE, fontSize: 15, lineHeight: 20 },
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
  etiqueta: { fontFamily: FUENTE, fontSize: 15, lineHeight: 20, fontWeight: '700' as const },
} as const;
