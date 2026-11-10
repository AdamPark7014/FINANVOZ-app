import type { ReactElement } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import {
  FUENTE,
  cifraEnPalabras,
  espacio,
  etiquetaHablada,
  formatearCentavos,
  heroeDia,
  Icono,
  OBJETIVO_TACTIL_MIN,
  Orbe,
  Texto,
  useTema,
} from '../../ui';
import { pistaQuincena } from '../../servicios';
import { useHeroeEnNavegacion } from '../navegacion/TonoNavegacion';
import { BarraDinero } from './BarraDinero';
import { PistaQuincena } from './PistaQuincena';
import {
  CONTEXTO_CIFRA_HOY_PUEDES,
  CONTEXTO_CIFRA_LIBRE_NEGATIVO,
  TITULO_HOY_LIBRE_NEGATIVO,
  TITULO_HOY_PUEDES_GASTAR,
} from '../principal/textos';
import { OCULTAR_ETIQUETA_VISIBLE } from '../principal/Chip';
import { SinIngreso } from './SinIngreso';
import type { ChipIntencion } from '../../asistente/chips';
import {
  EJEMPLO_INTENCION,
  ETIQUETA_PUEDES_DECIRME,
  pistaEjemploIntencion,
  saludoPorHora,
  TEXTO_AL_DIA_HEROE,
  textoFaltanteHoy,
  textoHastaIngreso,
  TITULO_PUEDES_DECIRME,
} from './textos';
import type { Asistente } from './useAsistente';

/** Intenciones de «Puedes decirme», en el orden del tablero B1. */
const EJEMPLOS: readonly ChipIntencion['clave'][] = ['gaste', 'puedo_gastar', 'me_pagaron'];

/** Margen de lo que va dentro y debajo de la placa. */
const MARGEN = espacio.xl;

/** Letra de la cifra: entre más larga, más chica, para que siempre quepa en un renglón con «al día». */
function tamanoCifra(
  cifra: string,
  escalaTexto: number,
): { fontSize: number; lineHeight: number; letterSpacing: number } {
  const base = cifra.length <= 4 ? 104 : cifra.length <= 6 ? 84 : 64;
  // Ya es enorme: con texto grande del sistema no crece más, o no cabría en la pantalla.
  const fontSize = base / Math.max(1, escalaTexto);
  return { fontSize, lineHeight: Math.round(fontSize * 1.08), letterSpacing: -fontSize * 0.045 };
}

/**
 * El asistente en reposo (`02 §4`, premium 08-11): mientras no hay turnos de esta sesión, habla primero. La placa pino
 * se funde con la navegación y trae el saludo, «Hoy puedes gastar» con la cifra enorme y hasta cuándo; debajo, sin
 * tarjetas, tu dinero en una barra («Cómo lo calculé ›» abre el desglose), la pista a la quincena, lo pendiente con sus
 * respuestas de un toque (`pendientes`) y «Puedes decirme» con frases que también se tocan.
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
  const { c, esquema } = useTema();
  const { fontScale } = useWindowDimensions();
  const { ctx } = useSesion();
  const vista = a.vista;
  const h = heroeDia[esquema];
  const saludo = saludoPorHora(new Date(ctx.reloj.ahora()).getHours());
  const conPlaca = vista.estado !== 'sin_ingreso';
  useHeroeEnNavegacion(conPlaca);
  const negativo = vista.estado === 'libre_negativo';
  const cifra = negativo ? 0 : vista.hoyPuedesCentavos;
  const cifraTexto = formatearCentavos(cifra, 'pesos');
  const secundario = negativo
    ? textoFaltanteHoy(formatearCentavos(vista.faltante), vista.proximoIngreso?.etiqueta ?? null)
    : (textoHastaIngreso(vista) ?? vista.mensaje);
  const ejemplos = EJEMPLOS.flatMap((clave) => a.chips.filter((ch) => ch.clave === clave));
  // D1: la pista solo cuando el día se reparte hasta un ingreso conocido (el mismo de «hasta tu quincena…»).
  const proximo = vista.estadoHorizonte === 'normal' ? vista.proximoIngreso : null;
  const pista = useVista((ctx) => (proximo ? pistaQuincena(ctx, proximo) : null));
  return (
    <ScrollView
      testID="reposo"
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: espacio.xl, gap: espacio.xl }}
      keyboardShouldPersistTaps="handled"
    >
      {conPlaca ? (
        <View
          testID="cabecera-dia"
          style={{
            backgroundColor: h.fondo,
            borderBottomLeftRadius: 36,
            borderBottomRightRadius: 36,
            paddingHorizontal: MARGEN,
            paddingTop: espacio.l,
            paddingBottom: espacio.xxl,
          }}
        >
          {/* Al jalar la lista hacia abajo, arriba sigue el pino y no asoma el fondo claro. */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -600,
              left: 0,
              right: 0,
              height: 600,
              backgroundColor: h.fondo,
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
            <Orbe tamano={26} />
            {/* El ancla de Maestro para cerrar el teclado: texto fijo arriba, nunca un botón. */}
            <Text
              testID="hoy-fecha"
              style={{ fontFamily: FUENTE, fontSize: 15, lineHeight: 20, color: h.textoSecundario }}
            >
              {saludo}
            </Text>
          </View>
          {/* La etiqueta visible no se lee aparte: la cifra ya dice «Hoy puedes gastar doscientos…» (`02 §15`). */}
          <Text
            testID={negativo ? 'hoy-libre-negativo-etiqueta' : 'hoy-puedes-etiqueta'}
            {...OCULTAR_ETIQUETA_VISIBLE}
            style={{
              fontFamily: FUENTE,
              fontSize: 17,
              lineHeight: 24,
              color: h.textoSecundario,
              marginTop: espacio.xl,
            }}
          >
            {negativo ? TITULO_HOY_LIBRE_NEGATIVO : TITULO_HOY_PUEDES_GASTAR}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              columnGap: espacio.s,
            }}
          >
            <Text
              testID="hoy-puedes"
              accessibilityRole="header"
              accessibilityLabel={`${negativo ? CONTEXTO_CIFRA_LIBRE_NEGATIVO : CONTEXTO_CIFRA_HOY_PUEDES} ${cifraEnPalabras(cifra, 'pesos')}`}
              style={{
                flexShrink: 1,
                fontFamily: FUENTE,
                fontWeight: '300',
                color: h.texto,
                fontVariant: ['tabular-nums'],
                ...tamanoCifra(cifraTexto, fontScale),
              }}
            >
              {cifraTexto}
            </Text>
            {negativo ? null : (
              <Text
                {...OCULTAR_ETIQUETA_VISIBLE}
                style={{ fontFamily: FUENTE, fontSize: 20, lineHeight: 26, color: h.textoSecundario }}
              >
                {TEXTO_AL_DIA_HEROE}
              </Text>
            )}
          </View>
          {secundario ? (
            <Text
              testID="hoy-secundario"
              accessibilityLabel={etiquetaHablada(secundario)}
              style={{
                fontFamily: FUENTE,
                fontSize: 17,
                lineHeight: 24,
                marginTop: espacio.xs,
                color: negativo ? h.faltante : h.texto,
              }}
            >
              {secundario}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ paddingHorizontal: MARGEN, gap: espacio.xl }}>
        {conPlaca ? (
          <>
            {/* D1: tu dinero en una barra; «Cómo lo calculé ›» abre el desglose debajo. */}
            <BarraDinero
              vista={vista}
              abierto={a.verDesglose}
              alPresionar={() => a.setVerDesglose((v) => !v)}
            />
            {desglose}
            {pista ? <PistaQuincena pista={pista} /> : null}
          </>
        ) : (
          <View style={{ gap: espacio.s }}>
            <Texto variante="secundario" tono="secundario" testID="hoy-fecha" style={{ fontWeight: '600' }}>
              {saludo}
            </Texto>
            <SinIngreso vista={vista} alConfigurarIngreso={alConfigurarIngreso} />
          </View>
        )}

        {pendientes}

        {ejemplos.length > 0 ? (
          <View accessibilityLabel={ETIQUETA_PUEDES_DECIRME} testID="puedes-decirme">
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: FUENTE,
                fontSize: 14,
                lineHeight: 20,
                color: c.textoSecundario,
                paddingBottom: espacio.xs,
              }}
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
                  minHeight: OBJETIVO_TACTIL_MIN + espacio.s,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: c.borde,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: espacio.m,
                  paddingVertical: espacio.s,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text
                  importantForAccessibility="no"
                  style={{ fontFamily: FUENTE, flexShrink: 1, fontSize: 17, lineHeight: 24, color: c.texto }}
                >
                  {`«${EJEMPLO_INTENCION[chip.clave]}»`}
                </Text>
                <Icono nombre="microfono" color={c.textoSecundario} tamano={18} grosor={1.8} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
