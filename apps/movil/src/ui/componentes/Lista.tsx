import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import { etiquetaHablada } from '../formato';
import { golpe } from '../haptica';
import { useTema } from '../tema';
import {
  coloresCategoria,
  espacio,
  OBJETIVO_TACTIL_MIN,
  radio,
  sombra,
  type FamiliaCategoria,
} from '../tokens';
import { Icono, type NombreIcono } from './Iconos';
import { Texto, type TonoTexto } from './Texto';

/**
 * Listas agrupadas (pase de pulido, 22-11): el patrón de Ajustes de iPhone con la piel de Finanvoz. Un `Grupo` es una
 * tarjeta con filas separadas por una línea fina que empieza después del ícono; arriba, una etiqueta corta, y abajo,
 * una nota opcional. Cada `Fila` lleva un mosaico de color (decorativo), título, una línea de apoyo, un valor a la
 * derecha y el chevron si abre algo. El lector de pantalla oye título, apoyo y valor en una sola etiqueta.
 */

const ICONO = 32;

/** El título grande de las pantallas secundarias (30/38, extra negro, apretado), como en las apps del sistema. */
export const ESTILO_TITULO_PANTALLA = {
  fontSize: 30,
  lineHeight: 38,
  fontWeight: '800',
  letterSpacing: -0.6,
} as const;

/**
 * Lo que lee el lector de pantalla: título, valor y (si se da) la acción, sin el chevron. El valor va completo
 * (quien no ve la pantalla oye lo mismo que se ve) y las cifras en palabras (`02 §15`).
 */
export function etiquetaFilaAjuste(titulo: string, valor?: string | null, accion?: string): string {
  const limpio = valor?.trim().replace(/[.\s]+$/, '');
  return etiquetaHablada([titulo, limpio, accion].filter((p): p is string => Boolean(p)).join('. '));
}

export function Grupo({
  titulo,
  nota,
  children,
  testID,
  testIDTitulo,
  sangria,
  style,
}: {
  /** Etiqueta corta arriba de la tarjeta («Tu dinero»). */
  titulo?: string;
  testIDTitulo?: string;
  /**
   * Fuerza la línea entre filas a empezar después del ícono (filas que son componentes propios); un número es el
   * ancho de lo que va a la izquierda (p. ej. el cuadro de fecha de 44).
   */
  sangria?: boolean | number;
  /** Nota al pie, en letra chica («Todo se guarda cifrado…»). */
  nota?: string | null;
  children: ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, esquema } = useTema();
  const filas = aplanar(children);
  return (
    <View style={[{ gap: espacio.s }, style]} {...(testID ? { testID } : {})}>
      {titulo ? (
        <Texto
          variante="etiqueta"
          tono="secundario"
          accessibilityRole="header"
          style={{ paddingHorizontal: espacio.xs }}
          {...(testIDTitulo ? { testID: testIDTitulo } : {})}
        >
          {titulo}
        </Texto>
      ) : null}
      <View
        style={{
          backgroundColor: c.superficie,
          borderRadius: radio.l,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.borde,
          overflow: 'hidden',
          ...sombra.tarjeta[esquema],
          shadowOpacity: esquema === 'claro' ? 0.05 : 0.3,
        }}
      >
        {filas.map((fila, i) => (
          <Fragment key={(isValidElement(fila) && fila.key) || i}>
            {i > 0 ? (
              <Separador
                sangria={typeof sangria === 'number' ? sangria : (sangria ?? tieneIcono(fila)) ? ICONO : 0}
              />
            ) : null}
            {fila}
          </Fragment>
        ))}
      </View>
      {nota ? (
        <Texto variante="pequeno" tono="secundario" style={{ paddingHorizontal: espacio.xs }}>
          {nota}
        </Texto>
      ) : null}
    </View>
  );
}

/** Las filas de un grupo, sin nulos y con los fragmentos abiertos (para poner la línea entre cada una). */
function aplanar(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap((h) =>
    isValidElement(h) && h.type === Fragment
      ? aplanar((h.props as { children?: ReactNode }).children)
      : isValidElement(h)
        ? [h]
        : [],
  );
}

function tieneIcono(fila: ReactNode): boolean {
  return isValidElement(fila) && Boolean((fila.props as { icono?: unknown }).icono);
}

function Separador({ sangria }: { sangria: number }) {
  const { c } = useTema();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: c.borde,
        marginLeft: sangria > 0 ? espacio.l + sangria + espacio.m : espacio.l,
      }}
    />
  );
}

/** Mosaico chico de una fila: el color de una familia de categorías (como los íconos de colores de Ajustes). */
export function IconoFila({ icono, familia = 'casa' }: { icono: NombreIcono; familia?: FamiliaCategoria }) {
  const { esquema } = useTema();
  const p = coloresCategoria[esquema][familia];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: ICONO,
        height: ICONO,
        borderRadius: 10,
        backgroundColor: p.mosaico,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icono nombre={icono} color={p.icono} tamano={18} grosor={2} />
    </View>
  );
}

const FAMILIAS_INICIAL: readonly FamiliaCategoria[] = [
  'transporte',
  'salidas',
  'comidaFuera',
  'super',
  'antojos',
];

/**
 * La inicial de una persona en un círculo de color (siempre el mismo color para el mismo nombre). Decorativo: el
 * nombre va en el texto de la fila.
 */
export function Inicial({ nombre, tamano = 40 }: { nombre: string; tamano?: number }) {
  const { esquema } = useTema();
  let h = 0;
  for (const ch of nombre) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  const p = coloresCategoria[esquema][FAMILIAS_INICIAL[h % FAMILIAS_INICIAL.length] ?? 'casa'];
  const letra = (nombre.trim()[0] ?? '·').toLocaleUpperCase('es-MX');
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: tamano,
        height: tamano,
        borderRadius: tamano / 2,
        backgroundColor: p.mosaico,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Texto
        variante="cuerpoFuerte"
        style={{ color: p.icono, fontSize: tamano * 0.42, lineHeight: tamano * 0.6 }}
      >
        {letra}
      </Texto>
    </View>
  );
}

export interface FilaProps {
  titulo: string;
  /** Línea de apoyo bajo el título; nunca se corta. */
  apoyo?: string | null;
  tonoApoyo?: TonoTexto;
  /** Valor corto a la derecha («$6,500», «Normal»). */
  valor?: string | null;
  tonoValor?: TonoTexto;
  icono?: NombreIcono;
  familia?: FamiliaCategoria;
  /** Algo propio a la izquierda en vez del mosaico (p. ej. el cuadro de la fecha). */
  inicio?: ReactNode;
  /** Abre algo: muestra el chevron y responde al toque. */
  alPresionar?: () => void;
  pista?: string;
  etiquetaAccesible?: string;
  /** Acción que no se deshace o que borra: el título va en rojo y no hay chevron. */
  destructiva?: boolean;
  /** Algo propio a la derecha en vez del valor (p. ej. un anillo). */
  derecha?: ReactNode;
  /** Renglones extra bajo el apoyo (decorativos si la fila se toca: la etiqueta ya los dice). */
  pie?: ReactNode;
  testID?: string;
  testIDTitulo?: string;
  testIDApoyo?: string;
  /** El título se marca como encabezado (filas que encabezan una sección, como Ingreso). */
  tituloEncabezado?: boolean;
}

export function Fila({
  titulo,
  apoyo,
  tonoApoyo = 'secundario',
  valor,
  tonoValor = 'secundario',
  icono,
  familia,
  inicio,
  alPresionar,
  pista,
  etiquetaAccesible,
  destructiva = false,
  derecha,
  pie,
  testID,
  testIDTitulo,
  testIDApoyo,
  tituloEncabezado = false,
}: FilaProps) {
  const { c } = useTema();
  const apoyoLimpio = apoyo?.trim() ? apoyo.trim() : null;
  const etiqueta =
    etiquetaAccesible ?? etiquetaFilaAjuste(titulo, [apoyoLimpio, valor].filter(Boolean).join('. ') || null);
  const contenido = (
    <View
      accessibilityElementsHidden={Boolean(alPresionar)}
      importantForAccessibility={alPresionar ? 'no-hide-descendants' : 'auto'}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.m,
        minHeight: 56,
        paddingHorizontal: espacio.l,
        paddingVertical: espacio.m,
      }}
    >
      {inicio ?? (icono ? <IconoFila icono={icono} {...(familia ? { familia } : {})} /> : null)}
      <View style={{ flex: 1, gap: espacio.xxs }}>
        <Texto
          variante="cuerpo"
          tono={destructiva ? 'faltante' : 'normal'}
          style={{ fontWeight: '500' }}
          {...(tituloEncabezado ? { accessibilityRole: 'header' as const } : {})}
          {...(testIDTitulo ? { testID: testIDTitulo } : {})}
        >
          {titulo}
        </Texto>
        {apoyoLimpio ? (
          <Texto variante="secundario" tono={tonoApoyo} {...(testIDApoyo ? { testID: testIDApoyo } : {})}>
            {apoyoLimpio}
          </Texto>
        ) : null}
        {pie}
      </View>
      {derecha ??
        (valor ? (
          <Texto variante="cuerpo" tono={tonoValor} style={{ fontVariant: ['tabular-nums'] }}>
            {valor}
          </Texto>
        ) : null)}
      {alPresionar && !destructiva ? (
        <Icono nombre="chevronDerecha" color={c.textoSecundario} tamano={16} grosor={2.2} />
      ) : null}
    </View>
  );
  if (!alPresionar) {
    return (
      <View {...(testID ? { testID } : {})} accessible accessibilityLabel={etiqueta}>
        {contenido}
      </View>
    );
  }
  return (
    <Pressable
      {...(testID ? { testID } : {})}
      onPress={alPresionar}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      {...(pista ? { accessibilityHint: pista } : {})}
      android_ripple={{ color: c.superficieAlterna }}
      style={({ pressed }) => ({
        minHeight: OBJETIVO_TACTIL_MIN,
        backgroundColor: pressed ? c.superficieAlterna : 'transparent',
      })}
    >
      {contenido}
    </Pressable>
  );
}

export interface FilaInterruptorProps {
  titulo: string;
  apoyo?: string;
  pista?: string;
  valor: boolean;
  alCambiar: (valor: boolean) => void;
  icono?: NombreIcono;
  familia?: FamiliaCategoria;
  deshabilitado?: boolean;
  testID?: string;
}

/** Fila con interruptor: toda la fila se toca, el lector la oye como «interruptor» con su estado. */
export function FilaInterruptor({
  titulo,
  apoyo,
  pista,
  valor,
  alCambiar,
  icono,
  familia,
  deshabilitado = false,
  testID,
}: FilaInterruptorProps) {
  const { c } = useTema();
  const cambiar = (v: boolean) => {
    golpe('eleccion');
    alCambiar(v);
  };
  return (
    <Pressable
      {...(testID ? { testID } : {})}
      onPress={() => cambiar(!valor)}
      disabled={deshabilitado}
      accessibilityRole="switch"
      accessibilityLabel={etiquetaHablada(titulo)}
      accessibilityHint={pista ?? apoyo}
      accessibilityState={{ checked: valor, disabled: deshabilitado }}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.m,
        paddingHorizontal: espacio.l,
        paddingVertical: espacio.m,
        backgroundColor: pressed ? c.superficieAlterna : 'transparent',
      })}
    >
      {icono ? <IconoFila icono={icono} {...(familia ? { familia } : {})} /> : null}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flex: 1, gap: espacio.xxs }}
      >
        <Texto variante="cuerpo" style={{ fontWeight: '500' }}>
          {titulo}
        </Texto>
        {apoyo ? (
          <Texto variante="secundario" tono="secundario">
            {apoyo}
          </Texto>
        ) : null}
      </View>
      <Switch
        value={valor}
        onValueChange={cambiar}
        disabled={deshabilitado}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        trackColor={{ true: c.acento, false: c.bordeControl }}
        thumbColor={c.superficie}
        ios_backgroundColor={c.bordeControl}
      />
    </Pressable>
  );
}

/** Bloque libre dentro de un `Grupo` (chips, texto o un botón) con el mismo margen que las filas. */
export function CeldaGrupo({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View
      {...(testID ? { testID } : {})}
      style={{ paddingHorizontal: espacio.l, paddingVertical: espacio.m, gap: espacio.s }}
    >
      {children}
    </View>
  );
}

/**
 * Título grande de una pantalla secundaria con su bajada, como en las apps del sistema: el título es el encabezado
 * para el lector; la bajada, apoyo en gris.
 */
export function TituloPantalla({
  titulo,
  bajada,
  testID,
  derecha,
}: {
  titulo: string;
  bajada?: string | null;
  testID?: string;
  derecha?: ReactNode;
}) {
  return (
    <View style={{ gap: espacio.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m }}>
        <Texto
          variante="titulo"
          accessibilityRole="header"
          style={[{ flex: 1 }, ESTILO_TITULO_PANTALLA]}
          {...(testID ? { testID } : {})}
        >
          {titulo}
        </Texto>
        {derecha}
      </View>
      {bajada ? (
        <Texto variante="cuerpo" tono="secundario">
          {bajada}
        </Texto>
      ) : null}
    </View>
  );
}

/**
 * Acción en píldora tonal con ícono (detalle de un movimiento, tarjetas): más ligera que un botón de contorno y
 * varias caben en una fila. `destructiva` pinta el texto en rojo; el estado presionado oscurece el fondo.
 */
export function AccionPildora({
  etiqueta,
  icono,
  alPresionar,
  pista,
  etiquetaAccesible,
  destructiva = false,
  testID,
}: {
  etiqueta: string;
  icono: NombreIcono;
  alPresionar: () => void;
  pista?: string;
  etiquetaAccesible?: string;
  destructiva?: boolean;
  testID?: string;
}) {
  const { c } = useTema();
  const color = destructiva ? c.faltante : c.acentoTexto;
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        golpe(destructiva ? 'aviso' : 'ligero');
        alPresionar();
      }}
      accessibilityRole="button"
      accessibilityLabel={etiquetaAccesible ?? etiquetaHablada(etiqueta)}
      accessibilityHint={pista}
      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      style={({ pressed }) => ({
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: espacio.xs + 2,
        paddingLeft: espacio.m - 2,
        paddingRight: espacio.m,
        borderRadius: radio.pastilla,
        backgroundColor: destructiva
          ? pressed
            ? c.borde
            : c.superficieAlterna
          : pressed
            ? c.borde
            : c.iconoFondo,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.xs + 2 }}
      >
        <Icono nombre={icono} color={color} tamano={17} grosor={2} />
        <Texto variante="cuerpoFuerte" style={{ color, fontSize: 15, lineHeight: 20 }}>
          {etiqueta}
        </Texto>
      </View>
    </Pressable>
  );
}

/** Un dato en dos columnas («Salió de · Cartera»): una sola etiqueta para el lector de pantalla. */
export function DatoFila({ etiqueta, valor, testID }: { etiqueta: string; valor: string; testID?: string }) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${etiqueta}: ${valor}`}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: espacio.m, paddingVertical: 2 }}
    >
      <Texto variante="secundario" tono="secundario" style={{ width: 92 }}>
        {etiqueta}
      </Texto>
      <Texto variante="secundario" style={{ flex: 1, fontWeight: '600' }}>
        {valor}
      </Texto>
    </View>
  );
}
