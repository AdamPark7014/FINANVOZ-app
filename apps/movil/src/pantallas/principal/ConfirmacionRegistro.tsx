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
import { GrupoChips } from './Chip';
import { mensajeError, NOMBRE_TIPO } from './textos';

type Motivo = Extract<ResultadoTexto, { resultado: 'confirmar' }>['motivo'];
type Registrado = Extract<ResultadoTexto, { resultado: 'registrado' }>;

const TITULO: Record<Motivo, string> = {
  monto_alto: 'Es un monto alto. Revísalo antes de guardar.',
  cuenta: 'Confirma la cuenta.',
  aproximado: 'Confírmame la cuenta.',
  impuestos: 'Es un gasto de impuestos. Revísalo antes de guardar.',
};

function pregunta(f: CuentaPorElegir): string {
  if (f.motivo === 'no_encontrada' && f.alias) {
    return `No tengo una cuenta «${f.alias}». ¿Cuál fue?`;
  }
  if (f.motivo === 'aproximado' && f.alias) return `¿Con «${f.alias}» te refieres a esta?`;
  return f.campo === 'origenId' ? '¿De qué cuenta salió?' : '¿A qué cuenta llegó?';
}

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
  motivo: Motivo;
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
      <Texto variante="subtitulo">{TITULO[motivo]}</Texto>
      {propuestas.map((p, i) => (
        <View key={i} style={{ gap: espacio.s }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
            <Texto variante="cuerpoFuerte" style={{ flex: 1 }}>
              {p.entrada.descripcion ?? NOMBRE_TIPO[p.entrada.tipo]}
            </Texto>
            <Cifra centavos={p.entrada.monto} />
          </View>
          {p.faltan.map((f) => (
            <View key={f.campo} style={{ gap: espacio.xs }}>
              <Texto variante="secundario" tono="secundario">
                {pregunta(f)}
              </Texto>
              <GrupoChips
                opciones={f.candidatas.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
                valor={elecciones[clave(i, f.campo)] ?? null}
                alCambiar={(id) => setElecciones((e) => ({ ...e, [clave(i, f.campo)]: id }))}
                prefijoTestID={`elegir-${i}-${f.campo}`}
              />
            </View>
          ))}
        </View>
      ))}
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
      <Boton
        etiqueta="Guardar"
        alPresionar={guardar}
        deshabilitado={!completo}
        pista={completo ? undefined : 'Elige una cuenta en los chips de arriba.'}
        testID="boton-guardar-confirmacion"
      />
      <Boton
        etiqueta="Cancelar"
        variante="texto"
        alPresionar={alCancelar}
        testID="boton-cancelar-confirmacion"
      />
    </Tarjeta>
  );
}
