import type { Centavos } from '@cartera/core';
import { useState } from 'react';
import { View } from 'react-native';
import { corregirSaldoTarjeta, editarTarjeta, type DetalleTarjeta } from '../../servicios';
import { useSesion } from '../../sesion/ProveedorSesion';
import { Boton, CampoMonto, CampoTexto, espacio, formatearCentavos, leerPesos, Texto } from '../../ui';
import { Chips } from '../onboarding/componentes';
import { leerDiaMes, leerEntero } from '../onboarding/ingreso';
import { useMostrarAviso } from '../principal/ProveedorAvisos';
import { useAvisoRegistro } from '../principal/useAvisoRegistro';
import { BTN_CANCELAR, MENSAJE_SALDO_SIN_CAMBIO, NOMBRE_MODO } from './textos';

type ModoLimite = 'dia' | 'dias';

const OPCIONES_LIMITE: readonly { valor: ModoLimite; etiqueta: string }[] = [
  { valor: 'dia', etiqueta: 'Un día del mes' },
  { valor: 'dias', etiqueta: 'Días después del corte' },
];
const OPCIONES_MODO: readonly { valor: 'totalero' | 'plan'; etiqueta: string }[] = [
  { valor: 'totalero', etiqueta: NOMBRE_MODO.totalero },
  { valor: 'plan', etiqueta: NOMBRE_MODO.plan },
];

/** "45.5" → 4550 puntos base (la tasa se escribe en porcentaje con hasta dos decimales). */
function leerTasa(texto: string): number | null {
  return leerPesos(texto.replace('%', ''));
}

/**
 * Editar tarjeta (`02 §8`, RF-TAR-01): nombre, últimos 4, ciclo (corte y fecha límite), límite, cómo la pagas
 * y la tasa (solo para ordenar qué pagar primero). El saldo no se edita aquí: se corrige aparte.
 */
export function EditarTarjeta({ d, alTerminar }: { d: DetalleTarjeta; alTerminar: () => void }) {
  const { ctx } = useSesion();
  const avisarRegistro = useAvisoRegistro();
  const [nombre, setNombre] = useState(d.nombre);
  const [ultimos4, setUltimos4] = useState(d.ultimos4 ?? '');
  const [corte, setCorte] = useState(String(d.ciclo.diaCorte));
  const [modoLimite, setModoLimite] = useState<ModoLimite>(
    d.ciclo.diaLimitePago !== undefined ? 'dia' : 'dias',
  );
  const [limitePago, setLimitePago] = useState(String(d.ciclo.diaLimitePago ?? d.ciclo.diasParaPagar ?? ''));
  const [limiteCredito, setLimiteCredito] = useState<Centavos | null>(d.limiteCredito);
  const [modo, setModo] = useState(d.modo);
  const [tasa, setTasa] = useState(d.tasaAnualBp === null ? '' : String(d.tasaAnualBp / 100));
  const [error, setError] = useState<string | null>(null);

  const guardar = () => {
    if (nombre.trim() === '') return setError('Escribe el nombre de la tarjeta.');
    if (ultimos4 !== '' && !/^\d{4}$/.test(ultimos4))
      return setError('Los últimos 4 son cuatro números, o déjalo vacío.');
    const diaCorte = leerDiaMes(corte);
    if (diaCorte === null) return setError('Escribe el día de corte, del 1 al 31.');
    const limite = modoLimite === 'dia' ? leerDiaMes(limitePago) : leerEntero(limitePago, 1, 60);
    if (limite === null) {
      return setError(
        modoLimite === 'dia'
          ? 'Escribe el día límite de pago, del 1 al 31.'
          : 'Escribe cuántos días tienes para pagar después del corte.',
      );
    }
    if (limiteCredito === null || limiteCredito <= 0) return setError('Escribe tu límite de crédito.');
    const tasaBp = tasa.trim() === '' ? null : leerTasa(tasa);
    if (tasa.trim() !== '' && tasaBp === null) return setError('Escribe la tasa así: 45.5');
    try {
      const r = editarTarjeta(ctx, d.id, {
        nombre: nombre.trim(),
        ultimos4: ultimos4 === '' ? null : ultimos4,
        diaCorte,
        ...(modoLimite === 'dia' ? { diaLimitePago: limite } : { diasParaPagar: limite }),
        limiteCredito,
        modo,
        tasaAnualBp: tasaBp,
      });
      avisarRegistro(`Guardé los cambios de tu ${nombre.trim()}.`, r.deshacer ?? undefined);
      alTerminar();
    } catch {
      setError('No pude guardar la tarjeta. Revisa el día de corte y el día límite.');
    }
  };

  return (
    <View style={{ gap: espacio.m }} testID="editar-tarjeta">
      <CampoTexto testID="editar-nombre" etiqueta="Nombre" valor={nombre} alCambiar={setNombre} />
      <CampoTexto
        testID="editar-ultimos4"
        etiqueta="Últimos 4 números (opcional)"
        teclado="number-pad"
        valor={ultimos4}
        alCambiar={setUltimos4}
        nativo={{ maxLength: 4 }}
      />
      <CampoTexto
        testID="editar-corte"
        etiqueta={ETIQUETA_DIA_CORTE}
        teclado="number-pad"
        valor={corte}
        alCambiar={setCorte}
      />
      <Chips
        testID="editar-modo-limite"
        etiqueta={PREGUNTA_MODO_LIMITE}
        opciones={OPCIONES_LIMITE}
        valor={modoLimite}
        alCambiar={setModoLimite}
      />
      <CampoTexto
        testID="editar-limite-pago"
        etiqueta={modoLimite === 'dia' ? ETIQUETA_DIA_LIMITE_PAGO : ETIQUETA_DIAS_PARA_PAGAR}
        teclado="number-pad"
        valor={limitePago}
        alCambiar={setLimitePago}
      />
      <CampoMonto
        testID="editar-limite-credito"
        etiqueta="Límite de crédito"
        valorInicial={d.limiteCredito}
        alCambiar={setLimiteCredito}
      />
      <Chips
        testID="editar-modo"
        etiqueta="¿Cómo la pagas?"
        opciones={OPCIONES_MODO}
        valor={modo}
        alCambiar={setModo}
      />
      <CampoTexto
        testID="editar-tasa"
        etiqueta="Tasa anual (opcional)"
        ayuda="Solo la uso para decirte qué tarjeta conviene pagar primero."
        ejemplo="45.5"
        teclado="decimal-pad"
        valor={tasa}
        alCambiar={setTasa}
      />
      {error ? (
        <Texto variante="secundario" tono="faltante" accessibilityLiveRegion="polite">
          {error}
        </Texto>
      ) : null}
      <Boton etiqueta="Guardar cambios" alPresionar={guardar} testID="editar-guardar" />
      <Boton etiqueta={BTN_CANCELAR} variante="texto" alPresionar={alTerminar} testID="editar-cancelar" />
    </View>
  );
}

/**
 * Corregir saldo (`02 §8`, `04 §4` caso 22): lo que dice el banco que debes hoy. Registra la diferencia como
 * ajuste (con "Deshacer"); nunca cuenta como pago.
 */
export function CorregirSaldo({ d, alTerminar }: { d: DetalleTarjeta; alTerminar: () => void }) {
  const { ctx } = useSesion();
  const avisarRegistro = useAvisoRegistro();
  const mostrar = useMostrarAviso();
  const [monto, setMonto] = useState<Centavos | null>(null);
  const [sentido, setSentido] = useState<'debo' | 'a_favor'>('debo');
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={{ gap: espacio.m }} testID="corregir-saldo">
      <Texto variante="secundario" tono="secundario">
        {d.saldoAFavor > 0
          ? `Según lo que llevo, tienes ${formatearCentavos(d.saldoAFavor)} a favor. Escribe lo que dice tu banco, sin contar meses sin intereses.`
          : `Según lo que llevo, debes ${formatearCentavos(d.saldoRevolvente)}. Escribe lo que dice tu banco, sin contar meses sin intereses.`}
      </Texto>
      <Chips
        testID="corregir-sentido"
        opciones={[
          { valor: 'debo', etiqueta: 'Debo' },
          { valor: 'a_favor', etiqueta: 'Tengo saldo a favor' },
        ]}
        valor={sentido}
        alCambiar={setSentido}
      />
      <CampoMonto testID="corregir-monto" etiqueta="Saldo según tu banco" alCambiar={setMonto} />
      {error ? (
        <Texto variante="secundario" tono="faltante">
          {error}
        </Texto>
      ) : null}
      <Boton
        etiqueta="Corregir saldo"
        testID="corregir-guardar"
        alPresionar={() => {
          if (monto === null) return setError('Escribe el saldo que dice tu banco.');
          try {
            const r = corregirSaldoTarjeta(ctx, d.id, sentido === 'debo' ? monto : -monto);
            if (r.transaccionId) {
              avisarRegistro(`Listo: corregí el saldo de tu ${d.nombre}.`, {
                transaccionId: r.transaccionId,
              });
            } else {
              mostrar({ mensaje: MENSAJE_SALDO_SIN_CAMBIO });
            }
            alTerminar();
          } catch {
            setError('No pude corregir el saldo. Intenta de nuevo.');
          }
        }}
      />
      <Boton etiqueta={BTN_CANCELAR} variante="texto" alPresionar={alTerminar} />
    </View>
  );
}
