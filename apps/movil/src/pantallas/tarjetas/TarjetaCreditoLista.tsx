import { Pressable, Text, View } from 'react-native';
import type { CuentaDebes, TarjetaVista } from '../../servicios';
import {
  AnilloUso,
  coloresCategoria,
  coloresCuenta,
  cifraEnPalabras,
  espacio,
  formatearCentavos,
  FUENTE,
  Mosaico,
  OBJETIVO_TACTIL_MIN,
  Texto,
  useTema,
} from '../../ui';
import { BotonPildora } from '../../ui/componentes/BotonPildora';
import {
  BTN_PAGAR_LISTA,
  etiquetaAccesibleTarjetaEnLista,
  PISTA_ABRIR_DETALLE_TARJETA,
  PISTA_PAGAR_LISTA,
  subtituloTarjetaLista,
  textoPngiLista,
  textoPorcentajeUso,
  textoUsasDeLimite,
} from './textos';

/**
 * Tarjeta de crédito en Cuentas (`02 §11`, tablero D6 de B+): el renglón con el mosaico violeta, el nombre, «Usas
 * $1,850 de $15,000 · corte lun 9 nov» y el anillo de uso; y, si hay pago para no generar intereses, la caja con la
 * cifra, la fecha límite y «Pagar» (abre el detalle con el pago listo). Tocar el renglón abre el detalle. Lo que
 * debes se ve en su tarjeta violeta del carrusel de arriba.
 */
export function TarjetaCreditoLista({
  d,
  t,
  alAbrir,
  alPagar,
}: {
  d: CuentaDebes;
  t: TarjetaVista | null;
  alAbrir?: () => void;
  alPagar?: () => void;
}) {
  const { c, esquema } = useTema();
  const violeta = coloresCuenta[esquema].credito.acento;
  const aFavor = d.saldo < 0;
  const renglon = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, minHeight: 60 }}>
      <Mosaico familia="salidas" icono="tarjeta" tamano={44} />
      <View style={{ flex: 1, gap: 1 }}>
        <Texto variante="cuerpoFuerte" style={{ fontSize: 17, lineHeight: 22, fontWeight: '700' }}>
          {d.nombre}
        </Texto>
        <Texto variante="secundario" tono="secundario" style={{ lineHeight: 20 }}>
          {aFavor
            ? 'Saldo a favor'
            : t
              ? textoUsasDeLimite(
                  formatearCentavos(t.deudaTotal),
                  formatearCentavos(t.limiteCredito),
                  t.etiquetaProximoCorte,
                )
              : subtituloTarjetaLista(d, t)}
        </Texto>
      </View>
      {t ? (
        <AnilloUso
          testID={`cuenta-${d.id}-anillo-uso`}
          fraccion={t.usoBp / 10_000}
          texto={textoPorcentajeUso(t.usoPorcentaje)}
          color={violeta}
          riel={coloresCategoria[esquema].salidas.mosaico}
          tinta={c.texto}
        />
      ) : null}
    </View>
  );
  return (
    <View
      testID={`tarjeta-credito-${d.id}`}
      style={{
        backgroundColor: c.superficie,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: c.borde,
        paddingHorizontal: espacio.l,
        paddingVertical: espacio.m,
        gap: 10,
      }}
    >
      {alAbrir ? (
        <Pressable
          testID={`cuenta-${d.id}`}
          onPress={alAbrir}
          accessibilityRole="button"
          accessibilityLabel={etiquetaAccesibleTarjetaEnLista(d, t)}
          accessibilityHint={PISTA_ABRIR_DETALLE_TARJETA}
          style={({ pressed }) => ({ minHeight: OBJETIVO_TACTIL_MIN, opacity: pressed ? 0.7 : 1 })}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {renglon}
          </View>
        </Pressable>
      ) : (
        <View testID={`cuenta-${d.id}`} accessible accessibilityLabel={etiquetaAccesibleTarjetaEnLista(d, t)}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {renglon}
          </View>
        </View>
      )}
      {d.meses > 0 ? (
        <Texto variante="secundario" testID={`cuenta-${d.id}-meses`}>
          {`Meses sin intereses que faltan: ${formatearCentavos(d.meses)}`}
        </Texto>
      ) : null}
      {aFavor ? (
        <Texto variante="secundario" tono="secundario">
          No se suma a tu dinero libre.
        </Texto>
      ) : null}
      {t && t.pngi > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: espacio.m,
            backgroundColor: c.fondo,
            borderRadius: 18,
            paddingVertical: espacio.m,
            paddingLeft: espacio.l,
            paddingRight: espacio.m,
          }}
        >
          <View
            accessible
            accessibilityLabel={`${textoPngiLista(t.etiquetaFechaLimite)}: ${cifraEnPalabras(t.pngi)}`}
            testID={`cuenta-${d.id}-pngi`}
            style={{ flex: 1, gap: 1 }}
          >
            <Text
              style={{
                fontFamily: FUENTE,
                fontSize: 14,
                lineHeight: 19,
                fontWeight: '600',
                color: c.textoSecundario,
              }}
            >
              {textoPngiLista(t.etiquetaFechaLimite)}
            </Text>
            <Text
              style={{
                fontFamily: FUENTE,
                fontSize: 26,
                lineHeight: 32,
                fontWeight: '800',
                color: c.texto,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatearCentavos(t.pngi)}
            </Text>
          </View>
          {alPagar ? (
            <BotonPildora
              etiqueta={BTN_PAGAR_LISTA}
              variante="lleno"
              alto={48}
              pista={PISTA_PAGAR_LISTA}
              etiquetaAccesible={`${BTN_PAGAR_LISTA} ${d.nombre}`}
              alPresionar={alPagar}
              testID={`cuenta-${d.id}-pagar`}
            />
          ) : null}
        </View>
      ) : t ? (
        <Texto variante="secundario" tono="secundario" testID={`cuenta-${d.id}-limite-pago`}>
          {`Fecha límite: ${t.etiquetaFechaLimite} · próximo corte: ${t.etiquetaProximoCorte}`}
        </Texto>
      ) : d.limiteCredito !== null ? (
        <Texto variante="secundario" tono="secundario">
          {`Límite: ${formatearCentavos(d.limiteCredito)}`}
        </Texto>
      ) : null}
    </View>
  );
}
