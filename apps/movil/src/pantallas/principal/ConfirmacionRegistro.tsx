import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  confirmarRegistro,
  type CuentaPorElegir,
  type EntradaMovimiento,
  type OrigenDictado,
  type PropuestaMovimiento,
  type ResultadoTexto,
} from '../../servicios';
import { enlaceAnaliticaCorreccion } from '../../servicios/correcciones';
import { useAnalitica } from '../../sesion/ProveedorAnalitica';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, Cifra, espacio, Tarjeta, Texto } from '../../ui';
import { GrupoChips, OCULTAR_ETIQUETA_VISIBLE } from './Chip';
import { useAnuncio } from './ProveedorAvisos';
import {
  ETIQUETA_CANCELAR,
  ETIQUETA_GUARDAR,
  mensajeError,
  NOMBRE_TIPO,
  PISTA_ELEGIR_CUENTA_CONFIRMACION,
  preguntaCuentaConfirmacionRegistro,
  TITULO_CONFIRMAR_REGISTRO,
} from './textos';

type Registrado = Extract<ResultadoTexto, { resultado: 'registrado' }>;

const clave = (i: number, campo: CuentaPorElegir['campo']) => `${i}:${campo}`;

/** Montar una vez en Registrar: enlaza `aplicarCorreccion` con la analítica opt-in (pendiente 30, voz). */
export function EnlaceAnaliticaCorreccion() {
  const registrarEvento = useAnalitica();
  useEffect(() => {
    enlaceAnaliticaCorreccion(registrarEvento);
    return () => enlaceAnaliticaCorreccion(null);
  }, [registrarEvento]);
  return null;
}

/**
 * Tarjeta de confirmación (02-UX §5.3): una fila por movimiento con las cuentas que faltan como chips, y
 * "Guardar". Lo aproximado viene preseleccionado; nada se guarda hasta tocar "Guardar".
 */
export function ConfirmacionRegistro({
  propuestas,
  motivo,
  origen,
  alGuardar,
  alCancelar,
}: {
  propuestas: readonly PropuestaMovimiento[];
  motivo: Extract<ResultadoTexto, { resultado: 'confirmar' }>['motivo'];
  origen: OrigenDictado;
  alGuardar: (r: Registrado) => void;
  alCancelar: () => void;
}) {
  const { ctx } = useSesion();
  const [elecciones, setElecciones] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {};
    propuestas.forEach((p, i) =>
      p.faltan.forEach((f) => {
        const unica = f.candidatas[0];
        if (f.motivo === 'aproximado' && f.candidatas.length === 1 && unica)
          inicial[clave(i, f.campo)] = unica.id;
      }),
    );
    return inicial;
  });
  const [error, setError] = useState<string | null>(null);
  // VoiceOver: el error al guardar se anuncia (en Android lo lee la región viva).
  useAnuncio(error);
  const completo = propuestas.every((p, i) => p.faltan.every((f) => elecciones[clave(i, f.campo)]));

  const guardar = () => {
    const entradas = propuestas.map((p, i) => {
      const extra: Record<string, string> = {};
      for (const f of p.faltan) {
        const id = elecciones[clave(i, f.campo)];
        if (id) extra[f.campo] = id;
      }
      return { ...p.entrada, ...extra } as EntradaMovimiento;
    });
    // La cuenta elegida para un alias que no reconocí se aprende (06 §12).
    const aprender = propuestas.flatMap((p, i) =>
      p.faltan.flatMap((f) => {
        const id = elecciones[clave(i, f.campo)];
        return f.alias && id && f.motivo !== 'ambigua' ? [{ alias: f.alias, cuentaId: id }] : [];
      }),
    );
    try {
      alGuardar(confirmarRegistro(ctx, entradas, origen, { aprender }));
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <Tarjeta testID="confirmacion-registro">
      <Texto variante="subtitulo">{TITULO_CONFIRMAR_REGISTRO[motivo]}</Texto>
      {propuestas.map((p, i) => (
        <View key={i} style={{ gap: espacio.s }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
            <Texto variante="cuerpoFuerte" style={{ flex: 1 }}>
              {p.entrada.descripcion ?? NOMBRE_TIPO[p.entrada.tipo]}
            </Texto>
            <Cifra centavos={p.entrada.monto} />
          </View>
          {p.faltan.map((f) => {
            const leyenda = preguntaCuentaConfirmacionRegistro(f);
            return (
              <View key={f.campo} style={{ gap: espacio.xs }}>
                <Texto variante="secundario" tono="secundario" {...OCULTAR_ETIQUETA_VISIBLE}>
                  {leyenda}
                </Texto>
                <GrupoChips
                  opciones={f.candidatas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
                  valor={elecciones[clave(i, f.campo)] ?? null}
                  alCambiar={(id) => setElecciones((e) => ({ ...e, [clave(i, f.campo)]: id }))}
                  prefijoTestID={`elegir-${i}-${f.campo}`}
                  etiqueta={leyenda}
                />
              </View>
            );
          })}
        </View>
      ))}
      {error ? (
        <Texto variante="secundario" tono="faltante" accessibilityLiveRegion="polite">
          {error}
        </Texto>
      ) : null}
      <Boton
        etiqueta={ETIQUETA_GUARDAR}
        alPresionar={guardar}
        deshabilitado={!completo}
        pista={completo ? undefined : PISTA_ELEGIR_CUENTA_CONFIRMACION}
        testID="boton-guardar-confirmacion"
      />
      <Boton
        etiqueta={ETIQUETA_CANCELAR}
        variante="texto"
        alPresionar={alCancelar}
        testID="boton-cancelar-confirmacion"
      />
    </Tarjeta>
  );
}
