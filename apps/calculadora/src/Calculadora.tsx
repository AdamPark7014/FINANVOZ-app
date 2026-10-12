import { useId, useMemo, useState } from 'react';
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
  error?: string | undefined;
}

function CampoPesos({ etiqueta, ayuda, valor, onCambio, error }: CampoProps) {
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
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describe}
        />
      </div>
      {error && (
        <p id={idError} className="error">
          {error}
        </p>
      )}
    </div>
  );
}

type Estado =
  | { tipo: 'incompleto' }
  | { tipo: 'error'; errores: Partial<Record<'ingreso' | 'deudas' | 'msi' | 'precio', string>> }
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

function Resultado({ resultado: r, meses }: { resultado: ResultadoCapacidad; meses: number }) {
  const tope = r.limitante === 'msi' ? r.topeMsi : r.topeDeuda;
  const limitante =
    r.limitante === 'msi'
      ? `Te limitan tus meses sin intereses: lo recomendado es que no pasen de ${pct(PARAMETROS_CAPACIDAD.topeMsiBp)} de tu ingreso (${formatearPesos(tope)} al mes).`
      : `Te limita el total de tus deudas: lo recomendado es que tus pagos no pasen de ${pct(PARAMETROS_CAPACIDAD.topeDeudaBp)} de tu ingreso (${formatearPesos(tope)} al mes).`;

  return (
    <section className="resultado" aria-live="polite" aria-labelledby="titulo-resultado">
      <h2 id="titulo-resultado">Tu resultado</h2>
      <p className="etiqueta">Puedes sumar en mensualidades</p>
      <p className="cifra" data-prueba="capacidad">
        {formatearPesos(r.capacidadMensual)}
        <span className="unidad"> al mes</span>
      </p>
      {r.capacidadMensual === 0 ? (
        <p className="aviso" data-prueba="mensaje-tope">
          {r.rebasaRecomendacion
            ? 'Tus pagos ya rebasan la recomendación. Antes de comprar a meses, conviene bajar lo que debes.'
            : 'Ya estás justo en el tope recomendado. Una compra más a meses lo pasaría.'}
        </p>
      ) : (
        <p data-prueba="limitante">{limitante}</p>
      )}

      {r.compra && (
        <div className={`veredicto ${r.compra.cabe ? 'si' : 'no'}`} data-prueba="veredicto">
          <p className="veredicto-titulo">{r.compra.cabe ? 'Sí cabe' : 'No cabe'}</p>
          <p>
            {r.compra.cabe
              ? r.compra.margen === 0
                ? `La mensualidad de ${formatearPesos(r.compra.cuotaMaxima)} a ${meses} meses te deja justo en el límite (margen $0).`
                : `La mensualidad de ${formatearPesos(r.compra.cuotaMaxima)} a ${meses} meses cabe y te deja ${formatearPesos(r.compra.margen)} de margen.`
              : `La mensualidad de ${formatearPesos(r.compra.cuotaMaxima)} a ${meses} meses pasa tu capacidad por ${formatearPesos(-r.compra.margen)}.`}
          </p>
        </div>
      )}

      <h3>Precio máximo según el plazo</h3>
      <table className="plazos">
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
  const idMeses = useId();
  const estado = useMemo(
    () => calcular(ingreso, deudas, msi, precio, meses),
    [ingreso, deudas, msi, precio, meses],
  );
  const errores = estado.tipo === 'error' ? estado.errores : {};

  return (
    <>
      <form
        className="tarjeta"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Calculadora de meses sin intereses"
      >
        <CampoPesos
          etiqueta="¿Cuánto te llega al mes?"
          ayuda="Lo que recibes ya con descuentos."
          valor={ingreso}
          onCambio={setIngreso}
          error={errores.ingreso}
        />
        <CampoPesos
          etiqueta="¿Cuánto pagas al mes de deudas?"
          ayuda="Tarjetas, préstamos, crédito de auto y meses sin intereses."
          valor={deudas}
          onCambio={setDeudas}
          error={errores.deudas}
        />
        <CampoPesos
          etiqueta="De eso, ¿cuánto es de meses sin intereses?"
          valor={msi}
          onCambio={setMsi}
          error={errores.msi}
        />
        <fieldset className="compra">
          <legend>¿Quieres revisar una compra? (opcional)</legend>
          <CampoPesos etiqueta="Precio" valor={precio} onCambio={setPrecio} error={errores.precio} />
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
