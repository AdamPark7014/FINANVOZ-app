import { UMBRAL_USO_BP } from '@cartera/core';
import { View } from 'react-native';
import type { CuentaDebes, TarjetaVista } from '../../servicios';
import { Barra, Cifra, formatearCentavos, Tarjeta, Texto, espacio } from '../../ui';
import { contextoSaldoTarjeta } from '../principal/textos';
import {
  etiquetaAccesibleBarraUsoTarjeta,
  etiquetaAccesibleTarjetaEnLista,
  PISTA_ABRIR_DETALLE_TARJETA,
  textoUsoLimiteTarjeta,
} from './textos';

/** Fila de tarjeta de crédito en Cuentas → Debes (`02 §11`). */
export function TarjetaCreditoLista({
  d,
  t,
  alAbrir,
}: {
  d: CuentaDebes;
  t: TarjetaVista | null;
  alAbrir?: () => void;
}) {
  const aFavor = d.saldo < 0;
  return (
    <Tarjeta
      testID={`cuenta-${d.id}`}
      {...(alAbrir
        ? {
            alPresionar: alAbrir,
            etiquetaAccesible: etiquetaAccesibleTarjetaEnLista(d, t),
            pista: PISTA_ABRIR_DETALLE_TARJETA,
          }
        : {})}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
        <View style={{ flex: 1, gap: espacio.xxs }}>
          <Texto variante="cuerpoFuerte">{d.nombre}</Texto>
          <Texto variante="secundario" tono="secundario">
            {aFavor ? 'Saldo a favor' : 'Tarjeta de crédito'}
          </Texto>
        </View>
        <Cifra
          centavos={aFavor ? -d.saldo : d.saldo}
          contexto={contextoSaldoTarjeta(d.nombre, aFavor)}
          testID={`cuenta-${d.id}-saldo`}
        />
      </View>
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
        <Texto variante="secundario" testID={`cuenta-${d.id}-pngi`}>
          {`Para no generar intereses: ${formatearCentavos(t.pngi)} antes del ${t.etiquetaFechaLimite}`}
        </Texto>
      ) : t ? (
        <Texto variante="secundario" tono="secundario" testID={`cuenta-${d.id}-limite-pago`}>
          {`Fecha límite: ${t.etiquetaFechaLimite} · próximo corte: ${t.etiquetaProximoCorte}`}
        </Texto>
      ) : null}
      {t ? (
        <>
          <Barra
            llenoBp={t.usoBp}
            marcaBp={UMBRAL_USO_BP}
            etiquetaAccesible={etiquetaAccesibleBarraUsoTarjeta(t.usoPorcentaje, t.limiteCredito)}
            testID={`cuenta-${d.id}-barra-uso`}
          />
          <Texto variante="secundario" tono="secundario" importantForAccessibility="no">
            {textoUsoLimiteTarjeta(t.usoPorcentaje, formatearCentavos(t.limiteCredito))}
          </Texto>
        </>
      ) : d.limiteCredito !== null ? (
        <Texto variante="secundario" tono="secundario">
          {`Límite: ${formatearCentavos(d.limiteCredito)}`}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}
