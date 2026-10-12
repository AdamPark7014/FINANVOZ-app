import type { Centavos } from '@cartera/core';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import {
  agregarTarjetaCredito,
  type EntradaTarjeta,
  type TarjetaCreada,
  type TarjetaPorAgregar,
} from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, espacio, Tarjeta, Texto } from '../../ui';
import { Chips, MensajeError } from '../onboarding/componentes';
import { leerDiaMes, leerEntero } from '../onboarding/ingreso';

type ModoLimite = 'dia' | 'dias';
type SiNo = 'si' | 'no';
type Incluye = 'si' | 'no' | 'no_se';

interface FilaMsi {
  clave: number;
  mensualidad: Centavos | null;
  restantes: string;
}

const OPCIONES_LIMITE: readonly { valor: ModoLimite; etiqueta: string }[] = [
  { valor: 'dia', etiqueta: 'Un día del mes' },
  { valor: 'dias', etiqueta: 'Días después del corte' },
];
const OPCIONES_SI_NO: readonly { valor: SiNo; etiqueta: string }[] = [
  { valor: 'si', etiqueta: 'Sí' },
  { valor: 'no', etiqueta: 'No' },
];
const OPCIONES_INCLUYE: readonly { valor: Incluye; etiqueta: string }[] = [
  { valor: 'si', etiqueta: 'Sí, ya lo incluye' },
  { valor: 'no', etiqueta: 'No' },
  { valor: 'no_se', etiqueta: 'No sé' },
];

/** "nu" → "Nu": el alias dictado como nombre sugerido. */
function nombreSugerido(alias: string | null): string {
  if (!alias) return '';
  return alias.charAt(0).toUpperCase() + alias.slice(1);
}

/**
 * Formulario de tarjeta de crédito nueva (`02 §3.1`, O4): ciclo, límite, modo, saldo obligatorio, meses que ya
 * tenías y "¿El saldo ya los incluye?". Lo usan el onboarding, Cuentas → "Agregar tarjeta" y la frase dictada de
 * una tarjeta que no existe (`tarjeta_por_agregar`, con lo dictado prellenado). Devuelve los campos y `guardar`
 * para que cada pantalla ponga los botones donde le toque.
 */
export function useFormularioTarjeta({
  prellenado,
  alGuardar,
}: {
  prellenado?: TarjetaPorAgregar | null;
  alGuardar: (t: TarjetaCreada) => void;
}): { campos: ReactNode; guardar: () => void } {
  const { ctx, refrescar } = useSesion();
  const [nombre, setNombre] = useState(nombreSugerido(prellenado?.alias ?? null));
  const [ultimos4, setUltimos4] = useState('');
  const [corte, setCorte] = useState(prellenado?.diaCorte ? String(prellenado.diaCorte) : '');
  const [modoLimite, setModoLimite] = useState<ModoLimite>(
    prellenado?.diasParaPagar && !prellenado.diaLimitePago ? 'dias' : 'dia',
  );
  const [limitePago, setLimitePago] = useState(
    prellenado?.diaLimitePago
      ? String(prellenado.diaLimitePago)
      : prellenado?.diasParaPagar
        ? String(prellenado.diasParaPagar)
        : '',
  );
  const [limiteCredito, setLimiteCredito] = useState<Centavos | null>(null);
  const [completa, setCompleta] = useState<SiNo | null>(null);
  const [saldo, setSaldo] = useState<Centavos | null>(null);
  const [conMeses, setConMeses] = useState<SiNo>('no');
  const [filas, setFilas] = useState<FilaMsi[]>([{ clave: 0, mensualidad: null, restantes: '' }]);
  const [incluye, setIncluye] = useState<Incluye | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cambiarFila = (clave: number, cambio: Partial<FilaMsi>) =>
    setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, ...cambio } : f)));

  /** Arma la entrada o dice qué falta (`02 §14`: qué pasó + qué hacer). */
  const armar = (): EntradaTarjeta | string => {
    if (nombre.trim() === '') return 'Escribe el nombre de la tarjeta.';
    if (ultimos4 !== '' && !/^\d{4}$/.test(ultimos4))
      return 'Los últimos 4 son cuatro números, o déjalo vacío.';
    const diaCorte = leerDiaMes(corte);
    if (diaCorte === null) return 'Escribe el día de corte, del 1 al 31.';
    const limite = modoLimite === 'dia' ? leerDiaMes(limitePago) : leerEntero(limitePago, 1, 60);
    if (limite === null) {
      return modoLimite === 'dia'
        ? 'Escribe el día límite de pago, del 1 al 31.'
        : 'Escribe cuántos días tienes para pagar después del corte.';
    }
    if (limiteCredito === null || limiteCredito <= 0) return 'Escribe tu límite de crédito.';
    if (completa === null) return 'Dime si la pagas completa cada mes.';
    if (saldo === null) return 'Escribe cuánto debes hoy. Si no lo tienes a la mano, agrégala después.';
    const msiPrevios: { mensualidad: number; restantes: number }[] = [];
    if (conMeses === 'si') {
      for (const f of filas) {
        const restantes = leerEntero(f.restantes, 1, 48);
        if (f.mensualidad === null || f.mensualidad <= 0 || restantes === null) {
          return 'En cada compra a meses escribe la mensualidad y cuántas te faltan (1 a 48).';
        }
        msiPrevios.push({ mensualidad: f.mensualidad, restantes });
      }
      if (incluye === null) return 'Dime si el saldo que me diste ya incluye esos meses.';
    }
    return {
      nombre: nombre.trim(),
      ...(ultimos4 !== '' ? { ultimos4 } : {}),
      // Lo dictado también sirve para reconocerla la próxima vez ("mi nu…").
      ...(prellenado?.alias ? { alias: [prellenado.alias] } : {}),
      diaCorte,
      ...(modoLimite === 'dia' ? { diaLimitePago: limite } : { diasParaPagar: limite }),
      limiteCredito,
      modo: completa === 'si' ? 'totalero' : 'plan',
      saldo,
      msiPrevios,
      ...(msiPrevios.length > 0 && incluye !== null ? { saldoIncluyeMsi: incluye } : {}),
    };
  };

  const guardar = () => {
    const entrada = armar();
    if (typeof entrada === 'string') {
      setError(entrada);
      return;
    }
    let creada: TarjetaCreada;
    try {
      creada = agregarTarjetaCredito(ctx, entrada);
    } catch {
      setError('No pude guardar la tarjeta. Revisa el día de corte y el día límite.');
      return;
    }
    refrescar();
    alGuardar(creada);
  };

  const campos = (
    <>
      <CampoTexto
        testID="tarjeta-nombre"
        etiqueta="Nombre"
        ejemplo="Nu, Oro, Costco"
        valor={nombre}
        alCambiar={setNombre}
      />
      <CampoTexto
        testID="tarjeta-ultimos4"
        etiqueta="Últimos 4 números (opcional)"
        ejemplo="8812"
        teclado="number-pad"
        valor={ultimos4}
        alCambiar={setUltimos4}
        nativo={{ maxLength: 4 }}
      />
      <CampoTexto
        testID="tarjeta-corte"
        etiqueta="Día de corte"
        ejemplo="28"
        teclado="number-pad"
        valor={corte}
        alCambiar={setCorte}
      />
      <Chips
        testID="tarjeta-modo-limite"
        etiqueta="¿Cómo sabes cuándo pagar?"
        opciones={OPCIONES_LIMITE}
        valor={modoLimite}
        alCambiar={setModoLimite}
      />
      <CampoTexto
        testID="tarjeta-limite-pago"
        etiqueta={modoLimite === 'dia' ? 'Día límite de pago' : 'Días para pagar después del corte'}
        ejemplo={modoLimite === 'dia' ? '18' : '20'}
        teclado="number-pad"
        valor={limitePago}
        alCambiar={setLimitePago}
      />
      <CampoMonto testID="tarjeta-limite-credito" etiqueta="Límite de crédito" alCambiar={setLimiteCredito} />
      <Chips
        testID="tarjeta-completa"
        etiqueta="¿La pagas completa cada mes?"
        opciones={OPCIONES_SI_NO}
        valor={completa}
        alCambiar={setCompleta}
      />
      <CampoMonto
        testID="tarjeta-saldo"
        etiqueta="¿Cuánto debes hoy en esta tarjeta?"
        ayuda="Es el saldo actual de la app de tu banco, no el pago mínimo."
        alCambiar={setSaldo}
      />
      <Chips
        testID="tarjeta-msi"
        etiqueta="¿Tienes compras a meses en esta tarjeta?"
        opciones={OPCIONES_SI_NO}
        valor={conMeses}
        alCambiar={setConMeses}
      />
      {conMeses === 'si' ? (
        <>
          <Texto variante="secundario" tono="secundario">
            No cuentan como gasto nuevo: solo apartamos cada mensualidad cuando toca.
          </Texto>
          {filas.map((f, i) => (
            <Tarjeta key={f.clave} testID={`tarjeta-msi-fila-${i}`}>
              <Texto variante="etiqueta">{`Compra ${i + 1}`}</Texto>
              <View style={{ gap: espacio.s }}>
                <CampoMonto
                  testID={`tarjeta-msi-mensualidad-${i}`}
                  etiqueta="Mensualidad"
                  alCambiar={(m) => cambiarFila(f.clave, { mensualidad: m })}
                />
                <CampoTexto
                  testID={`tarjeta-msi-restantes-${i}`}
                  etiqueta="¿Cuántas te faltan?"
                  ejemplo="6"
                  teclado="number-pad"
                  valor={f.restantes}
                  alCambiar={(t) => cambiarFila(f.clave, { restantes: t })}
                />
              </View>
              {filas.length > 1 ? (
                <Boton
                  variante="texto"
                  ancho="contenido"
                  etiqueta="Quitar"
                  etiquetaAccesible={`Quitar compra ${i + 1}`}
                  alPresionar={() => setFilas((fs) => fs.filter((x) => x.clave !== f.clave))}
                />
              ) : null}
            </Tarjeta>
          ))}
          <Boton
            testID="tarjeta-msi-otra"
            variante="secundario"
            etiqueta="Agregar otra compra a meses"
            alPresionar={() =>
              setFilas((fs) => [
                ...fs,
                { clave: (fs[fs.length - 1]?.clave ?? 0) + 1, mensualidad: null, restantes: '' },
              ])
            }
          />
          <Chips
            testID="tarjeta-incluye"
            etiqueta="¿El saldo que me diste ya incluye lo que te falta de esos meses?"
            opciones={OPCIONES_INCLUYE}
            valor={incluye}
            alCambiar={setIncluye}
          />
          {incluye === 'no_se' ? (
            <Texto variante="secundario" tono="secundario" testID="tarjeta-no-se-ayuda">
              No lo resto: puede que cuente de más lo que debes, nunca de menos. Compáralo con tu próximo
              estado de cuenta.
            </Texto>
          ) : null}
        </>
      ) : null}
      <MensajeError texto={error} />
    </>
  );

  return { campos, guardar };
}

/** El formulario completo con sus botones, para usarlo dentro de una pantalla o de una tarjeta. */
export function FormularioTarjetaNueva({
  prellenado,
  alGuardar,
  alCancelar,
  etiquetaCancelar = 'Cancelar',
}: {
  prellenado?: TarjetaPorAgregar | null;
  alGuardar: (t: TarjetaCreada) => void;
  alCancelar: () => void;
  etiquetaCancelar?: string;
}) {
  const { campos, guardar } = useFormularioTarjeta({ prellenado: prellenado ?? null, alGuardar });
  return (
    <View style={{ gap: espacio.m }} testID="formulario-tarjeta-nueva">
      {campos}
      <Boton testID="tarjeta-guardar" etiqueta="Guardar tarjeta" alPresionar={guardar} />
      <Boton
        testID="tarjeta-cancelar"
        variante="texto"
        etiqueta={etiquetaCancelar}
        alPresionar={alCancelar}
      />
    </View>
  );
}
