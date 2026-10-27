import type { ReactElement } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSesion } from '../../sesion/ProveedorSesion';
import {
  cifraEnPalabras,
  espacio,
  etiquetaHablada,
  formatearCentavos,
  Icono,
  margenPantalla,
  OBJETIVO_TACTIL_MIN,
  Texto,
  useTema,
} from '../../ui';
import {
  CONTEXTO_CIFRA_HOY_PUEDES,
  CONTEXTO_CIFRA_LIBRE_NEGATIVO,
  PISTA_OCULTAR_DESGLOSE,
  PISTA_VER_DESGLOSE,
  PISTA_VER_QUE_VIENE,
  TITULO_HOY_LIBRE_NEGATIVO,
  TITULO_HOY_PUEDES_GASTAR,
} from '../principal/textos';
import { OCULTAR_ETIQUETA_VISIBLE } from '../principal/Chip';
import { SinIngreso } from './SinIngreso';
import type { ChipIntencion } from '../../asistente/chips';
import {
  BTN_COMO_LO_CALCULE,
  EJEMPLO_INTENCION,
  ETIQUETA_PUEDES_DECIRME,
  pistaEjemploIntencion,
  saludoPorHora,
  textoFaltanteHoy,
  textoHastaIngreso,
  TITULO_PUEDES_DECIRME,
} from './textos';
import type { Asistente } from './useAsistente';

/** Intenciones de «Puedes decirme», en el orden del tablero B1. */
const EJEMPLOS: readonly ChipIntencion['clave'][] = ['gaste', 'puedo_gastar', 'me_pagaron'];

/**
 * El asistente en reposo (tablero B1, `02 §4`): mientras no hay turnos de esta sesión, habla primero. El saludo, «Hoy
 * puedes gastar» con la cifra grande y hasta cuándo; «Cómo lo calculé ›» abre el desglose; lo pendiente con sus
 * respuestas de un toque (`pendientes`, los turnos del día) y «Puedes decirme» con frases que también se tocan.
 */
export function Reposo({
  a,
  alConfigurarIngreso,
  desglose,
  pendientes,
}: {
  a: Asistente;
  alConfigurarIngreso: () => void;
  /** El panel del desglose (se ve debajo de «Cómo lo calculé» cuando está abierto). */
  desglose: ReactElement | null;
  /** Lo que el asistente dice primero: avisos de una vez, invitación a los avisos y los turnos del día. */
  pendientes: ReactElement | null;
}) {
  const { c } = useTema();
  const { ctx } = useSesion();
  const vista = a.vista;
  const saludo = saludoPorHora(new Date(ctx.reloj.ahora()).getHours());
  const negativo = vista.estado === 'libre_negativo';
  const cifra = negativo ? 0 : vista.hoyPuedesCentavos;
  const secundario = negativo
    ? textoFaltanteHoy(formatearCentavos(vista.faltante), vista.proximoIngreso?.etiqueta ?? null)
    : (textoHastaIngreso(vista) ?? vista.mensaje);
  const ejemplos = EJEMPLOS.flatMap((clave) => a.chips.filter((ch) => ch.clave === clave));
  return (
    <ScrollView
      testID="reposo"
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingHorizontal: margenPantalla + espacio.s,
        paddingTop: espacio.l,
        paddingBottom: espacio.xl,
        gap: espacio.xl,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {vista.estado === 'sin_ingreso' ? (
        <View style={{ gap: espacio.s }}>
          <Texto variante="secundario" tono="secundario" testID="hoy-fecha" style={{ fontWeight: '600' }}>
            {saludo}
          </Texto>
          <SinIngreso vista={vista} alConfigurarIngreso={alConfigurarIngreso} />
        </View>
      ) : (
        <View testID="cabecera-dia">
          {/* El ancla de Maestro para cerrar el teclado: texto fijo arriba, nunca un botón. */}
          <Text
            testID="hoy-fecha"
            style={{ fontSize: 17, lineHeight: 22, fontWeight: '600', color: c.textoSecundario }}
          >
            {saludo}
          </Text>
          <View style={{ marginTop: espacio.s }}>
            {/* La etiqueta visible no se lee aparte: la cifra ya dice «Hoy puedes gastar doscientos…» (`02 §15`). */}
            <Text
              testID={negativo ? 'hoy-libre-negativo-etiqueta' : 'hoy-puedes-etiqueta'}
              {...OCULTAR_ETIQUETA_VISIBLE}
              style={{ fontSize: 30, lineHeight: 38, fontWeight: '600', color: c.texto }}
            >
              {negativo ? TITULO_HOY_LIBRE_NEGATIVO : TITULO_HOY_PUEDES_GASTAR}
            </Text>
            <Text
              testID="hoy-puedes"
              accessibilityRole="header"
              accessibilityLabel={`${negativo ? CONTEXTO_CIFRA_LIBRE_NEGATIVO : CONTEXTO_CIFRA_HOY_PUEDES} ${cifraEnPalabras(cifra, 'pesos')}`}
              style={{
                fontSize: 84,
                lineHeight: 88,
                fontWeight: '800',
                letterSpacing: -3,
                marginLeft: -3,
                color: c.acentoTexto,
                fontVariant: ['tabular-nums'],
              }}
            >
              {formatearCentavos(cifra, 'pesos')}
            </Text>
          </View>
          {secundario ? (
            <Text
              testID="hoy-secundario"
              accessibilityLabel={etiquetaHablada(secundario)}
              style={{
                fontSize: 22,
                lineHeight: 30,
                fontWeight: '500',
                color: negativo ? c.faltante : c.texto,
              }}
            >
              {secundario}
            </Text>
          ) : null}
          <Pressable
            testID="boton-desglose"
            onPress={() => a.setVerDesglose((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={BTN_COMO_LO_CALCULE}
            accessibilityHint={
              a.verDesglose ? PISTA_OCULTAR_DESGLOSE : negativo ? PISTA_VER_QUE_VIENE : PISTA_VER_DESGLOSE
            }
            accessibilityState={{ expanded: a.verDesglose }}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              minHeight: OBJETIVO_TACTIL_MIN,
              marginTop: espacio.xxs,
              flexDirection: 'row',
              alignItems: 'center',
              gap: espacio.xxs,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 16, lineHeight: 22, fontWeight: '700', color: c.acentoTexto }}>
              {BTN_COMO_LO_CALCULE}
            </Text>
            <View style={{ transform: [{ rotate: a.verDesglose ? '90deg' : '0deg' }] }}>
              <Icono nombre="chevronDerecha" color={c.acentoTexto} tamano={18} grosor={2.4} />
            </View>
          </Pressable>
          {desglose}
        </View>
      )}

      {pendientes}

      {ejemplos.length > 0 ? (
        <View style={{ gap: espacio.s }} accessibilityLabel={ETIQUETA_PUEDES_DECIRME} testID="puedes-decirme">
          <Text
            accessibilityRole="header"
            style={{ fontSize: 14, lineHeight: 20, fontWeight: '700', color: c.textoSecundario }}
          >
            {TITULO_PUEDES_DECIRME}
          </Text>
          {ejemplos.map((chip) => (
            <Pressable
              key={chip.clave}
              testID={`chip-intencion-${chip.clave}`}
              onPress={() => a.tocarChip(chip)}
              accessibilityRole="button"
              accessibilityLabel={EJEMPLO_INTENCION[chip.clave]}
              accessibilityHint={pistaEjemploIntencion(chip)}
              style={({ pressed }) => ({
                minHeight: OBJETIVO_TACTIL_MIN,
                borderRadius: OBJETIVO_TACTIL_MIN / 2,
                backgroundColor: pressed ? c.superficieAlterna : c.superficie,
                borderWidth: 1,
                borderColor: c.borde,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: espacio.l,
                paddingVertical: espacio.s,
              })}
            >
              <Icono nombre="microfono" color={c.acentoTexto} tamano={18} grosor={2} />
              <Text
                importantForAccessibility="no"
                style={{ flexShrink: 1, fontSize: 16, lineHeight: 22, fontWeight: '500', color: c.texto }}
              >
                {`«${EJEMPLO_INTENCION[chip.clave]}»`}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
