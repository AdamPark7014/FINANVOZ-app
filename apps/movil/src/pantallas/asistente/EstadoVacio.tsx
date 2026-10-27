import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { textoMovimientoDelDia } from '../../asistente/conversacion';
import { listarMovimientos } from '../../servicios';
import { useVista } from '../../sesion/ProveedorSesion';
import { espacio, margenPantalla, Texto } from '../../ui';
import { TEXTO_PRIMER_USO, TITULO_PRIMER_USO } from '../principal/textos';
import { saludoDelDia, SUGERENCIA_DECIR, TITULO_ULTIMO_ENTENDIDO } from './textos';
import { TurnoRegistro } from './turnos/TurnoRegistro';

/**
 * Sin turnos todavía (Hoy C dentro de Hoy A, decisión 1): el micrófono enorme al centro, cómo se dice el primer
 * gasto y, si ya hubo alguno otro día, «Lo último que entendí».
 */
export function EstadoVacio({
  primerUso,
  hoyPuedes,
  encabezado,
  alVerMovimiento,
}: {
  primerUso: boolean;
  /** «$214» tal como lo muestra la cabecera; `null` sin ingreso configurado. */
  hoyPuedes: string | null;
  encabezado?: ReactNode;
  alVerMovimiento?: (id: string) => void;
}) {
  const ultimo = useVista((c) =>
    primerUso ? null : (listarMovimientos(c, { limite: 1 })[0]?.movimientos[0] ?? null),
  );
  return (
    <ScrollView
      testID="estado-vacio"
      style={{ flex: 1 }}
      contentContainerStyle={{
        flexGrow: 1,
        padding: margenPantalla,
        // La ayuda y «Lo último que entendí» no quedan pegados a la orilla redonda de la barra de voz (auditoría H1).
        paddingBottom: espacio.xxl,
        gap: espacio.xl,
        justifyContent: 'space-between',
      }}
      keyboardShouldPersistTaps="handled"
    >
      {encabezado ? <View style={{ gap: espacio.m }}>{encabezado}</View> : <View />}
      <View style={{ alignItems: 'center', gap: espacio.xl }}>
        {/* El saludo del día: la cifra de hoy y qué decir, como un asistente que habla primero. */}
        <Texto variante="titulo" alinear="center" testID="estado-vacio-saludo" accessibilityRole="header">
          {saludoDelDia(hoyPuedes)}
        </Texto>
        {primerUso ? (
          <Texto variante="cuerpoFuerte" alinear="center" testID="estado-vacio-titulo">
            {TITULO_PRIMER_USO}
          </Texto>
        ) : null}
        <Texto
          variante="cuerpo"
          tono="secundario"
          alinear="center"
          testID="estado-vacio-texto"
          style={{ maxWidth: 340 }}
        >
          {primerUso ? TEXTO_PRIMER_USO : SUGERENCIA_DECIR}
        </Texto>
      </View>
      {ultimo ? (
        <View style={{ gap: espacio.s }} testID="ultimo-entendido">
          <Texto variante="etiqueta" tono="secundario" accessibilityRole="header">
            {TITULO_ULTIMO_ENTENDIDO}
          </Texto>
          <TurnoRegistro
            turno={{
              id: `registro:${ultimo.id}`,
              de: 'asistente',
              clase: 'registro',
              texto: textoMovimientoDelDia(ultimo),
              ...(alVerMovimiento ? { abrir: () => alVerMovimiento(ultimo.id) } : {}),
            }}
            testID="ultimo-entendido-turno"
          />
        </View>
      ) : (
        <View />
      )}
    </ScrollView>
  );
}
