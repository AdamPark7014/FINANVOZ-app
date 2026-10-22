import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { FilaEntendi, PropuestaEntendi } from '../entendi';
import { espacio, OBJETIVO_TACTIL_MIN } from '../tokens';
import { useTema } from '../tema';
import { Boton } from './Boton';
import { Chip } from './Chip';
import { Cifra } from './Cifra';
import { Tarjeta } from './Tarjeta';
import { Texto } from './Texto';

/**
 * R1 «Entendí» (`docs/diseno/mockups-asistente.html` §2): cifra, filas tocables, efecto en tu día, «Sí» y
 * «Cambiar». Mientras se guarda, el botón muestra carga y no se puede tocar dos veces; si la acción falla, el error
 * se queda en la tarjeta y se puede reintentar.
 *
 * testIDs: `entendi`, `entendi-monto`, `entendi-fila-<clave>`, `entendi-opcion-<clave>-<valor>`, `entendi-efecto`,
 * `entendi-confirmar`, `entendi-cambiar`, `entendi-error`.
 */
export function TarjetaEntendi({
  propuesta,
  testID = 'entendi',
  mensajeError = 'No pude guardarlo. Intenta otra vez.',
}: {
  propuesta: PropuestaEntendi;
  testID?: string;
  /** Texto si `confirmar` lanza (quien conoce el error puede pasar uno más claro). */
  mensajeError?: string;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);

  const confirmar = async () => {
    if (guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await propuesta.confirmar.accion();
    } catch {
      setError(mensajeError);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Tarjeta testID={testID} accionesAnidadas>
      <Texto variante="etiqueta" tono="acento">
        {propuesta.titulo}
      </Texto>
      {propuesta.monto !== undefined ? (
        <Cifra centavos={propuesta.monto} tamano="grande" testID={`${testID}-monto`} />
      ) : null}
      <View style={{ gap: espacio.xxs }}>
        {propuesta.filas.map((fila) => (
          <Fila
            key={fila.clave}
            fila={fila}
            prefijo={testID}
            abierta={abierta === fila.clave}
            alTocar={() => setAbierta(abierta === fila.clave ? null : fila.clave)}
            alElegir={(valor) => {
              fila.alCambiar?.(valor);
              setAbierta(null);
            }}
          />
        ))}
      </View>
      {propuesta.efecto ? (
        <Texto variante="secundario" tono="secundario" testID={`${testID}-efecto`}>
          {propuesta.efecto}
        </Texto>
      ) : null}
      {error ? (
        <Texto variante="secundario" tono="faltante" testID={`${testID}-error`} accessibilityRole="alert">
          {error}
        </Texto>
      ) : null}
      <Boton
        etiqueta={propuesta.confirmar.etiqueta}
        alPresionar={() => void confirmar()}
        cargando={guardando}
        testID={`${testID}-confirmar`}
      />
      {propuesta.cambiar ? (
        <Boton
          etiqueta={propuesta.cambiar.etiqueta}
          variante="secundario"
          alPresionar={() => void propuesta.cambiar?.accion()}
          deshabilitado={guardando}
          testID={`${testID}-cambiar`}
        />
      ) : null}
      {propuesta.pista ? (
        <Texto variante="secundario" tono="secundario" style={{ textAlign: 'center' }}>
          {propuesta.pista}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}

function Fila({
  fila,
  prefijo,
  abierta,
  alTocar,
  alElegir,
}: {
  fila: FilaEntendi;
  prefijo: string;
  abierta: boolean;
  alTocar: () => void;
  alElegir: (valor: string) => void;
}) {
  const { c } = useTema();
  const editable = (fila.opciones?.length ?? 0) > 0 && fila.alCambiar !== undefined;
  const contenido = (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: espacio.s,
        minHeight: OBJETIVO_TACTIL_MIN,
        borderBottomWidth: 1,
        borderBottomColor: c.borde,
      }}
    >
      <Texto variante="secundario" tono="secundario">
        {fila.etiqueta}
      </Texto>
      <Texto variante="cuerpoFuerte" style={{ flexShrink: 1, textAlign: 'right' }}>
        {editable ? `${fila.valor}  ›` : fila.valor}
      </Texto>
    </View>
  );
  return (
    <View testID={`${prefijo}-fila-${fila.clave}`}>
      {editable ? (
        <Pressable
          onPress={alTocar}
          accessibilityRole="button"
          accessibilityLabel={`${fila.etiqueta}: ${fila.valor}`}
          accessibilityHint="Toca para cambiarlo"
          accessibilityState={{ expanded: abierta }}
        >
          {contenido}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={`${fila.etiqueta}: ${fila.valor}`}>
          {contenido}
        </View>
      )}
      {abierta && fila.opciones ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, paddingVertical: espacio.s }}>
          {fila.opciones.map((o) => (
            <Chip
              key={o.valor}
              etiqueta={o.etiqueta}
              seleccionado={o.etiqueta === fila.valor || o.valor === fila.valor}
              alPresionar={() => alElegir(o.valor)}
              testID={`${prefijo}-opcion-${fila.clave}-${o.valor}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
