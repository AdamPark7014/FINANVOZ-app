import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  capacidadEndeudamiento,
  PARAMETROS_CAPACIDAD,
  PLAZOS_MSI,
  type ResultadoCapacidad,
} from '@cartera/core';
import { formatearPesos, leerPesos } from './formato';

interface CampoProps {
  etiqueta: string;
  ayuda?: string;
  valor: string;
  onCambio: (v: string) => void;
  onSalir: () => void;
  error?: string | undefined;
  requerido?: boolean;
}

function CampoPesos({ etiqueta, ayuda, valor, onCambio, onSalir, error, requerido }: CampoProps) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const describe = [ayuda ? idAyuda : null, error ? idError : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      {ayuda && (
        <p id={idAyuda} className="ayuda">
          {ayuda}
        </p>
      )}
      <div className="pesos">
        <span aria-hidden="true">$</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          placeholder="0"
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          onBlur={onSalir}
          aria-invalid={error ? true : undefined}
          aria-required={requerido ? true : undefined}
          aria-describedby={describe}
        />
      </div>
      {error && (
        <p id={idError} className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type Campo = 'ingreso' | 'deudas' | 'msi' | 'precio';

type Estado =
  | { tipo: 'incompleto' }
  | { tipo: 'error'; errores: Partial<Record<Campo, string>> }
  | { tipo: 'listo'; resultado: ResultadoCapacidad; meses: number };

const MONTO_INVALIDO = 'Escribe solo números, por ejemplo 15,000 o 1,099.50.';

function calcular(ingreso: string, deudas: string, msi: string, precio: string, meses: number): Estado {
  if (ingreso.trim() === '') return { tipo: 'incompleto' };
  const vIngreso = leerPesos(ingreso);
  const vDeudas = deudas.trim() === '' ? 0 : leerPesos(deudas);
  const vMsi = msi.trim() === '' ? 0 : leerPesos(msi);
  const vPrecio = precio.trim() === '' ? undefined : leerPesos(precio);
  const errores: Extract<Estado, { tipo: 'error' }>['errores'] = {};
  if (vIngreso === null) errores.ingreso = MONTO_INVALIDO;
  if (vDeudas === null) errores.deudas = MONTO_INVALIDO;
  if (vMsi === null) errores.msi = MONTO_INVALIDO;
  if (vPrecio === null) errores.precio = MONTO_INVALIDO;
  if (vDeudas !== null && vMsi !== null && vMsi > vDeudas) {
    errores.msi = 'Tus meses sin intereses son parte de tus deudas: súmalos también arriba.';
  }
  if (
    vIngreso === null ||
    vDeudas === null ||
    vMsi === null ||
    vPrecio === null ||
    Object.keys(errores).length
  ) {
    return { tipo: 'error', errores };
  }
  const resultado = capacidadEndeudamiento({
    ingresoMensualNeto: vIngreso,
    pagosDeudaMensuales: vDeudas,
    pagosMsiMensuales: vMsi,
    compra: vPrecio === undefined || vPrecio === 0 ? undefined : { precio: vPrecio, meses },
  });
  return { tipo: 'listo', resultado, meses };
}

const pct = (bp: number) => `${bp / 100} %`;

/** Una sola línea para el lector de pantalla; el resultado completo se lee navegando. */
function resumir(estado: Estado): string {
  if (estado.tipo !== 'listo') return '';
  const r = estado.resultado;
  if (r.compra) {
    if (!r.compra.cabe) return `No cabe: te pasas por ${formatearPesos(-r.compra.margen)} al mes.`;
    return r.compra.margen === 0
      ? 'Sí cabe, pero justo: no te sobra nada al mes.'
      : `Sí cabe: te sobran ${formatearPesos(r.compra.margen)} al mes.`;
  }
  if (r.capacidadMensual === 0) {
    return r.rebasaRecomendacion
      ? 'Ya te pasas de lo recomendado.'
      : 'Ya estás justo en el límite recomendado.';
  }
  return `Puedes sumar hasta ${formatearPesos(r.capacidadMensual)} en pagos al mes.`;
}

/** Espera a que dejes de teclear para no anunciar cada tecla. */
export const RETRASO_ANUNCIO_MS = 600;

function useRetrasado<T>(valor: T, ms: number): T {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return retrasado;
}

function Resultado({ resultado: r, meses }: { resultado: ResultadoCapacidad; meses: number }) {
  const refTitulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    refTitulo.current?.focus();
  }, []);
  const idVeredicto = useId();
  const tope = r.limitante === 'msi' ? r.topeMsi : r.topeDeuda;
  const limitante =
    r.limitante === 'msi'
      ? `Te limitan tus meses sin intereses: lo recomendado es que no pasen de ${pct(PARAMETROS_CAPACIDAD.topeMsiBp)} de tu ingreso (${formatearPesos(tope)} al mes).`
      : `Te limita el total de tus deudas: lo recomendado es que tus pagos no pasen de ${pct(PARAMETROS_CAPACIDAD.topeDeudaBp)} de tu ingreso (${formatearPesos(tope)} al mes).`;

  return (
    <section className="resultado" aria-labelledby="titulo-resultado">
      <h2 id="titulo-resultado" ref={refTitulo} tabIndex={-1}>
        Tu resultado
      </h2>
      <p className="etiqueta">Puedes sumar en pagos al mes</p>
      <p className="cifra" data-prueba="capacidad">
        {formatearPesos(r.capacidadMensual)}
        <span className="unidad"> al mes</span>
      </p>
      {r.capacidadMensual === 0 ? (
        <p className="aviso" data-prueba="mensaje-tope">
          {r.rebasaRecomendacion
            ? 'Con lo que ya pagas, ya te pasas de lo recomendado. Antes de comprar a meses, conviene bajar lo que debes.'
            : 'Ya estás justo en el límite recomendado. Una compra más a meses te pasaría.'}
        </p>
      ) : (
        <p data-prueba="limitante">{limitante}</p>
      )}

      {r.compra && (
        <div
          className={`veredicto ${r.compra.cabe ? 'si' : 'no'}`}
          data-prueba="veredicto"
          role="group"
          aria-labelledby={idVeredicto}
        >
          <p className="veredicto-titulo" id={idVeredicto}>
            {r.compra.cabe ? 'Sí cabe' : 'No cabe'}
          </p>
          <p>
            {`Pagarías ${formatearPesos(r.compra.cuotaMaxima)} al mes durante ${meses} meses. `}
            {r.compra.cabe
              ? r.compra.margen === 0
                ? 'Cabe justo: no te sobra nada ($0 al mes).'
                : `Te sobran ${formatearPesos(r.compra.margen)} al mes.`
              : `Te pasas por ${formatearPesos(-r.compra.margen)} al mes.`}
          </p>
        </div>
      )}

      <h3>La compra más cara que te cabe, según los meses</h3>
      <table className="plazos">
        <caption className="solo-lector">Compra más cara que te cabe según los meses sin intereses</caption>
        <thead>
          <tr>
            <th scope="col">Meses</th>
            <th scope="col">Hasta</th>
          </tr>
        </thead>
        <tbody>
          {PLAZOS_MSI.map((n) => (
            <tr key={n}>
              <td>{n} meses</td>
              <td>{formatearPesos(r.precioMaximo[n])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function Calculadora() {
  const [ingreso, setIngreso] = useState('');
  const [deudas, setDeudas] = useState('');
  const [msi, setMsi] = useState('');
  const [precio, setPrecio] = useState('');
  const [meses, setMeses] = useState(12);
  const [tocados, setTocados] = useState<ReadonlySet<Campo>>(new Set());
  const idMeses = useId();
  const estado = useMemo(
    () => calcular(ingreso, deudas, msi, precio, meses),
    [ingreso, deudas, msi, precio, meses],
  );
  const errores = estado.tipo === 'error' ? estado.errores : {};
  const anuncio = useRetrasado(resumir(estado), RETRASO_ANUNCIO_MS);

  // El error de formato se muestra al salir del campo o al enviar, nunca a media escritura.
  const cambiar = (campo: Campo, fijar: (v: string) => void) => (v: string) => {
    fijar(v);
    setTocados((t) => {
      if (!t.has(campo)) return t;
      const sin = new Set(t);
      sin.delete(campo);
      return sin;
    });
  };
  const salir = (campo: Campo) => () => setTocados((t) => (t.has(campo) ? t : new Set(t).add(campo)));
  const errorVisible = (campo: Campo) => (tocados.has(campo) ? errores[campo] : undefined);

  return (
    <>
      <form
        className="tarjeta"
        onSubmit={(e) => {
          e.preventDefault();
          setTocados(new Set<Campo>(['ingreso', 'deudas', 'msi', 'precio']));
        }}
        aria-label="Calculadora de meses sin intereses"
      >
        <CampoPesos
          etiqueta="¿Cuánto te llega al mes?"
          ayuda="Lo que recibes ya con descuentos."
          valor={ingreso}
          onCambio={cambiar('ingreso', setIngreso)}
          onSalir={salir('ingreso')}
          error={errorVisible('ingreso')}
          requerido
        />
        <CampoPesos
          etiqueta="¿Cuánto pagas al mes de deudas?"
          ayuda="Tarjetas, préstamos, crédito de auto y meses sin intereses."
          valor={deudas}
          onCambio={cambiar('deudas', setDeudas)}
          onSalir={salir('deudas')}
          error={errorVisible('deudas')}
        />
        <CampoPesos
          etiqueta="De eso, ¿cuánto es de meses sin intereses?"
          valor={msi}
          onCambio={cambiar('msi', setMsi)}
          onSalir={salir('msi')}
          error={errorVisible('msi')}
        />
        <fieldset className="compra">
          <legend>¿Quieres revisar una compra? (opcional)</legend>
          <CampoPesos
            etiqueta="¿Cuánto cuesta?"
            valor={precio}
            onCambio={cambiar('precio', setPrecio)}
            onSalir={salir('precio')}
            error={errorVisible('precio')}
          />
          <div className="campo">
            <label htmlFor={idMeses}>Meses</label>
            <select id={idMeses} value={meses} onChange={(e) => setMeses(Number(e.target.value))}>
              {PLAZOS_MSI.map((n) => (
                <option key={n} value={n}>
                  {n} meses
                </option>
              ))}
            </select>
          </div>
        </fieldset>
        <p className="privado">Lo que escribes aquí se calcula en tu teléfono y no se envía a ningún lado.</p>
      </form>

      <p className="solo-lector" role="status" aria-live="polite" aria-atomic="true" data-prueba="anuncio">
        {anuncio}
      </p>
      {estado.tipo === 'listo' && <Resultado resultado={estado.resultado} meses={estado.meses} />}

      <aside className="fuentes">
        <p>
          <strong>De dónde salen los topes.</strong> Condusef recomienda que el total de tus pagos de deudas
          no pase de {pct(PARAMETROS_CAPACIDAD.topeDeudaBp)} de tu ingreso. Especialistas en finanzas
          personales sugieren que los meses sin intereses no pasen de {pct(PARAMETROS_CAPACIDAD.topeMsiBp)}.
        </p>
        <p>Esto es una estimación con los datos que escribes y no es asesoría financiera.</p>
      </aside>
    </>
  );
}
