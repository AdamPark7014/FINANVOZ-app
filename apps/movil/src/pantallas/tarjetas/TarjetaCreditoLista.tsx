import { UMBRAL_USO_BP } from '@cartera/core';
import { Pressable, Text, View } from 'react-native';
import type { CuentaDebes, TarjetaVista } from '../../servicios';
import {
  Barra,
  Cifra,
  cifraEnPalabras,
  espacio,
  formatearCentavos,
  Icono,
  OBJETIVO_TACTIL_MIN,
  Texto,
  useTema,
} from '../../ui';
import { BotonPildora } from '../../ui/componentes/BotonPildora';
import { contextoSaldoTarjeta } from '../principal/textos';
import {
  BTN_PAGAR_LISTA,
  etiquetaAccesibleBarraUsoTarjeta,
  etiquetaAccesibleTarjetaEnLista,
  PISTA_ABRIR_DETALLE_TARJETA,
  PISTA_PAGAR_LISTA,
  subtituloTarjetaLista,
  textoPngiLista,
  textoUsoCorteLista,
} from './textos';

/**
 * Tarjeta de crédito en Cuentas → Debes (`02 §11`, tablero B5): el renglón con el ícono, lo que debes y «la pagas
 * completa»; la barra de uso con el límite y el corte; y, si hay pago para no generar intereses, la caja con la
 * cifra, la fecha límite y «Pagar» (abre el detalle con el pago listo). Tocar el renglón abre el detalle.
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
  const { c } = useTema();
  const aFavor = d.saldo < 0;
  const renglon = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, minHeight: 56 }}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          backgroundColor: c.iconoFondo,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icono nombre="tarjeta" color={c.acento} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Texto variante="cuerpoFuerte" style={{ lineHeight: 22, fontWeight: '700' }}>
          {d.nombre}
        </Texto>
        <Texto variante="secundario" tono="secundario" style={{ lineHeight: 20 }}>
          {aFavor ? 'Saldo a favor' : subtituloTarjetaLista(d, t)}
        </Texto>
      </View>
      <Cifra
        centavos={aFavor ? -d.saldo : d.saldo}
        contexto={contextoSaldoTarjeta(d.nombre, aFavor)}
        testID={`cuenta-${d.id}-saldo`}
      />
    </View>
  );
  return (
    <View style={{ gap: 10, paddingVertical: espacio.s }}>
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
        <View testID={`cuenta-${d.id}`}>{renglon}</View>
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
      {t ? (
        <View style={{ gap: 6 }}>
          <Barra
            alto={8}
            llenoBp={t.usoBp}
            marcaBp={UMBRAL_USO_BP}
            etiquetaAccesible={etiquetaAccesibleBarraUsoTarjeta(t.usoPorcentaje, t.limiteCredito)}
            testID={`cuenta-${d.id}-barra-uso`}
          />
          <Texto variante="pequeno" tono="secundario" importantForAccessibility="no" style={{ fontSize: 13 }}>
            {textoUsoCorteLista(t.usoPorcentaje, formatearCentavos(t.limiteCredito), t.etiquetaProximoCorte)}
          </Texto>
        </View>
      ) : d.limiteCredito !== null ? (
        <Texto variante="secundario" tono="secundario">
          {`Límite: ${formatearCentavos(d.limiteCredito)}`}
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
            <Text style={{ fontSize: 14, lineHeight: 19, fontWeight: '600', color: c.textoSecundario }}>
              {textoPngiLista(t.etiquetaFechaLimite)}
            </Text>
            <Text
              style={{
                fontSize: 24,
                lineHeight: 30,
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
              alto={46}
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
      ) : null}
    </View>
  );
}
