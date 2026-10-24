import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { textoMovimientoDelDia } from '../../asistente/conversacion';
import { listarMovimientos } from '../../servicios';
import { useVista } from '../../sesion/ProveedorSesion';
import { espacio, margenPantalla, Texto } from '../../ui';
import type { BotonHablar } from '../../voz';
import { TEXTO_PRIMER_USO, TITULO_PRIMER_USO } from '../principal/textos';
import { MicrofonoAsistente } from './MicrofonoAsistente';
import { saludoDelDia, SUGERENCIA_DECIR, TEXTO_MANTEN_O_TOCA, TITULO_ULTIMO_ENTENDIDO } from './textos';
import { TurnoRegistro } from './turnos/TurnoRegistro';

/** Tamaño del micrófono cuando todavía no hay turnos: el orbe manda; el teclado es secundario. */
export const TAMANO_MICROFONO_VACIO = 136;

/**
 * Sin turnos todavía (Hoy C dentro de Hoy A, decisión 1): el micrófono enorme al centro, cómo se dice el primer
 * gasto y, si ya hubo alguno otro día, «Lo último que entendí».
 */
export function EstadoVacio({
  primerUso,
  hoyPuedes,
  escuchando,
  boton,
  encabezado,
  alVerMovimiento,
}: {
  primerUso: boolean;
  /** «$214» tal como lo muestra la cabecera; `null` sin ingreso configurado. */
  hoyPuedes: string | null;
  escuchando: boolean;
  boton: BotonHablar;
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
        <View testID="estado-vacio-mic" style={{ paddingVertical: espacio.m }}>
          <MicrofonoAsistente escuchando={escuchando} boton={boton} tamano={TAMANO_MICROFONO_VACIO} />
        </View>
        <Texto variante="etiqueta" tono="acento" alinear="center">
          {TEXTO_MANTEN_O_TOCA}
        </Texto>
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
