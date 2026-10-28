import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import type { CuentaDebes, CuentaTienes } from '../../servicios';
import {
  Cifra,
  cifraEnPalabras,
  coloresCuenta,
  espacio,
  FUENTE,
  Icono,
  margenPantalla,
  OBJETIVO_TACTIL_MIN,
  useTema,
  type ClaseCuenta,
  type NombreIcono,
} from '../../ui';
import { etiquetaContarEnCuenta } from '../arqueo/textos';
import { etiquetaFila, etiquetaVerCuenta, PISTA_ABRIR_CUENTA, PISTA_ABRIR_EFECTIVO } from '../cuentas/textos';
import { PISTA_ABRIR_DETALLE_TARJETA } from '../tarjetas/textos';
import {
  contextoSaldoTarjeta,
  contextoSaldoTienes,
  etiquetaPaginaCarrusel,
  PISTA_CONTAR_EFECTIVO,
  textoAbajoCredito,
  textoContasteEl,
} from './textos';

const SEPARACION = espacio.m;
const ALTO = 136;

/** Lo que va en el carrusel: tus cuentas (efectivo, débito, billetera, ahorro) y tus tarjetas de crédito. */
export type CuentaCarrusel =
  | { readonly tipo: 'tienes'; readonly c: CuentaTienes; readonly subtitulo: string | null }
  | {
      readonly tipo: 'credito';
      readonly d: CuentaDebes;
      readonly usoPorcentaje: number | null;
      readonly etiqueta: string;
    };

/**
 * Tus cuentas como tarjetas (dirección B+, D6): efectivo en menta, débito (y billetera o ahorro) en azul y crédito en
 * violeta, sin logotipos de bancos, una tras otra a lo ancho con su indicador de página. El efectivo se toca para
 * contarlo (y «⋯» abre su detalle); las demás abren su detalle. Cifras ya calculadas por `servicios/`.
 */
export function CarruselCuentas({
  cuentas,
  alContarEfectivo,
  alAbrirCuenta,
  alAbrirTarjeta,
}: {
  cuentas: readonly CuentaCarrusel[];
  alContarEfectivo?: (cuentaId: string) => void;
  alAbrirCuenta?: (cuentaId: string) => void;
  alAbrirTarjeta?: (tarjetaId: string) => void;
}) {
  const { c } = useTema();
  const { width } = useWindowDimensions();
  const ancho = Math.round(Math.min(260, Math.max(200, (width - margenPantalla * 2) * 0.58)));
  const [pagina, setPagina] = useState(0);
  return (
    <View style={{ gap: espacio.s }}>
      <ScrollView
        horizontal
        testID="seccion-tienes-lista"
        accessibilityRole="list"
        showsHorizontalScrollIndicator={false}
        snapToInterval={ancho + SEPARACION}
        decelerationRate="fast"
        // El carrusel va de borde a borde; la primera tarjeta empieza en el margen.
        style={{ marginHorizontal: -margenPantalla }}
        contentContainerStyle={{ paddingHorizontal: margenPantalla, gap: SEPARACION }}
        scrollEventThrottle={32}
        onScroll={(e) =>
          setPagina(Math.max(0, Math.round(e.nativeEvent.contentOffset.x / (ancho + SEPARACION))))
        }
      >
        {cuentas.map((x) =>
          x.tipo === 'tienes' ? (
            <TarjetaTienes
              key={x.c.id}
              c={x.c}
              subtitulo={x.subtitulo}
              ancho={ancho}
              {...(alContarEfectivo ? { alContar: () => alContarEfectivo(x.c.id) } : {})}
              {...(alAbrirCuenta ? { alAbrir: () => alAbrirCuenta(x.c.id) } : {})}
            />
          ) : (
            <TarjetaCredito
              key={x.d.id}
              x={x}
              ancho={ancho}
              {...(alAbrirTarjeta ? { alAbrir: () => alAbrirTarjeta(x.d.id) } : {})}
            />
          ),
        )}
      </ScrollView>
      {cuentas.length > 1 ? (
        <View
          testID="carrusel-paginas"
          accessible
          accessibilityLabel={etiquetaPaginaCarrusel(
            Math.min(pagina, cuentas.length - 1) + 1,
            cuentas.length,
          )}
          style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}
        >
          {cuentas.map((x, i) => (
            <View
              key={x.tipo === 'tienes' ? x.c.id : x.d.id}
              style={{
                width: i === pagina ? 18 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === pagina ? c.acento : c.borde,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function claseDe(subtipo: CuentaTienes['subtipo']): ClaseCuenta {
  return subtipo === 'efectivo' ? 'efectivo' : 'debito';
}

const ICONO: Record<ClaseCuenta, NombreIcono> = { efectivo: 'billete', debito: 'banco', credito: 'tarjeta' };

/** El cuerpo de una tarjeta de cuenta (D6): nombre arriba, la cifra grande y un renglón abajo; adorno en la esquina. */
function Cuerpo({
  clase,
  nombre,
  cifra,
  abajo,
  derecha,
}: {
  clase: ClaseCuenta;
  nombre: string;
  cifra: ReactNode;
  abajo: string | null;
  derecha?: ReactNode;
}) {
  const { esquema } = useTema();
  const t = coloresCuenta[esquema][clase];
  return (
    <View style={{ flex: 1, justifyContent: 'space-between', gap: espacio.s }}>
      {/* Los círculos de la esquina son solo adorno (D6). */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: -54,
          top: -54,
          width: 132,
          height: 132,
          borderRadius: 66,
          borderWidth: 20,
          borderColor: t.adorno,
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingRight: espacio.xl }}>
        {clase === 'efectivo' ? <Icono nombre={ICONO[clase]} color={t.texto} tamano={20} grosor={2} /> : null}
        <Text
          style={{
            fontFamily: FUENTE,
            flexShrink: 1,
            fontSize: 16,
            lineHeight: 21,
            fontWeight: '700',
            color: t.texto,
          }}
        >
          {nombre}
        </Text>
        {derecha}
      </View>
      <View style={{ gap: 2 }}>
        {cifra}
        {abajo ? (
          <Text
            style={{
              fontFamily: FUENTE,
              fontSize: 13,
              lineHeight: 18,
              fontWeight: '600',
              color: t.textoSecundario,
            }}
          >
            {abajo}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function estiloTarjeta(fondo: string, ancho: number) {
  return {
    width: ancho,
    minHeight: ALTO,
    borderRadius: 24,
    backgroundColor: fondo,
    padding: espacio.l,
    overflow: 'hidden' as const,
  };
}

function TarjetaTienes({
  c,
  subtitulo,
  ancho,
  alContar,
  alAbrir,
}: {
  c: CuentaTienes;
  subtitulo: string | null;
  ancho: number;
  alContar?: () => void;
  alAbrir?: () => void;
}) {
  const { esquema } = useTema();
  const clase = claseDe(c.subtipo);
  const t = coloresCuenta[esquema][clase];
  const efectivo = c.subtipo === 'efectivo';
  const abajo = efectivo ? textoContasteEl(c.contadaEl) : subtitulo;
  const contexto = contextoSaldoTienes(c.nombre);
  const cifra = (
    <Cifra
      centavos={c.saldo}
      contexto={contexto}
      testID={`cuenta-${c.id}-saldo`}
      style={{ fontFamily: FUENTE, fontSize: 34, lineHeight: 40, fontWeight: '800', color: t.texto }}
    />
  );
  const cuerpo = <Cuerpo clase={clase} nombre={c.nombre} cifra={cifra} abajo={abajo} />;
  // Efectivo: tocarla es contarlo (`02 §7`); «⋯» abre su detalle. Las demás abren su detalle.
  const principal = efectivo ? alContar : alAbrir;
  return (
    <View role="listitem" testID={`cuenta-${c.id}`} style={estiloTarjeta(t.fondo, ancho)}>
      {principal ? (
        <Pressable
          testID={efectivo ? `cuenta-${c.id}-accion` : `cuenta-${c.id}-abrir`}
          onPress={principal}
          accessibilityRole="button"
          accessibilityLabel={
            efectivo
              ? `${etiquetaContarEnCuenta(c.nombre)}. ${contexto} ${cifraEnPalabras(c.saldo)}`
              : etiquetaFila({ titulo: c.nombre, subtitulo, contexto, centavos: c.saldo })
          }
          accessibilityHint={efectivo ? PISTA_CONTAR_EFECTIVO : PISTA_ABRIR_CUENTA}
          style={({ pressed }) => ({ flex: 1, minHeight: OBJETIVO_TACTIL_MIN, opacity: pressed ? 0.85 : 1 })}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ flex: 1 }}
          >
            {cuerpo}
          </View>
        </Pressable>
      ) : (
        cuerpo
      )}
      {efectivo && alAbrir ? (
        <Pressable
          testID={`cuenta-${c.id}-ver`}
          onPress={alAbrir}
          accessibilityRole="button"
          accessibilityLabel={etiquetaVerCuenta(c.nombre)}
          accessibilityHint={PISTA_ABRIR_EFECTIVO}
          hitSlop={8}
          style={({ pressed }) => ({
            position: 'absolute',
            top: espacio.s,
            right: espacio.s,
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{ fontFamily: FUENTE, fontSize: 20, lineHeight: 22, fontWeight: '800', color: t.texto }}
          >
            ⋯
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function TarjetaCredito({
  x,
  ancho,
  alAbrir,
}: {
  x: Extract<CuentaCarrusel, { tipo: 'credito' }>;
  ancho: number;
  alAbrir?: () => void;
}) {
  const { esquema } = useTema();
  const t = coloresCuenta[esquema].credito;
  const aFavor = x.d.saldo < 0;
  const cifra = (
    <Cifra
      centavos={aFavor ? -x.d.saldo : x.d.saldo}
      contexto={contextoSaldoTarjeta(x.d.nombre, aFavor)}
      testID={`cuenta-${x.d.id}-saldo`}
      style={{ fontFamily: FUENTE, fontSize: 34, lineHeight: 40, fontWeight: '800', color: t.texto }}
    />
  );
  const cuerpo = (
    <Cuerpo
      clase="credito"
      nombre={x.d.nombre}
      cifra={cifra}
      abajo={textoAbajoCredito(aFavor, x.usoPorcentaje)}
    />
  );
  return (
    <View role="listitem" testID={`carrusel-${x.d.id}`} style={estiloTarjeta(t.fondo, ancho)}>
      {alAbrir ? (
        <Pressable
          testID={`carrusel-${x.d.id}-abrir`}
          onPress={alAbrir}
          accessibilityRole="button"
          accessibilityLabel={x.etiqueta}
          accessibilityHint={PISTA_ABRIR_DETALLE_TARJETA}
          style={({ pressed }) => ({ flex: 1, minHeight: OBJETIVO_TACTIL_MIN, opacity: pressed ? 0.85 : 1 })}
        >
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ flex: 1 }}
          >
            {cuerpo}
          </View>
        </Pressable>
      ) : (
        cuerpo
      )}
    </View>
  );
}
