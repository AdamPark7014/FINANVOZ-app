import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { centavosDePesos, pesosDeCentavos } from '../util/dinero';
import type { CapaDatos, Parametro, SesionAdmin } from './datos';
import { Cabecera, Cargando, ErrorCarga, SinPermiso } from './componentes/Estados';

type Tipo = 'pesos' | 'porcentaje' | 'texto';

/** Cada ajuste con nombre humano, su unidad y para qué sirve. */
const AJUSTES: { clave: string; etiqueta: string; tipo: Tipo; pista: string }[] = [
  {
    clave: 'precio_plus_mensual',
    etiqueta: 'Plus mensual',
    tipo: 'pesos',
    pista: 'Precio sugerido al registrar una venta.',
  },
  {
    clave: 'precio_plus_anual',
    etiqueta: 'Plus anual',
    tipo: 'pesos',
    pista: 'Precio sugerido al registrar una venta.',
  },
  {
    clave: 'precio_licencia_mes',
    etiqueta: 'Licencia por persona al mes',
    tipo: 'pesos',
    pista: 'Para cajas, cooperativas y empresas.',
  },
  {
    clave: 'comision_pct',
    etiqueta: 'Comisión general',
    tipo: 'porcentaje',
    pista: 'Sobre lo cobrado. Cada vendedor puede tener la suya en Vendedores.',
  },
  { clave: 'iva_pct', etiqueta: 'IVA', tipo: 'porcentaje', pista: 'Tasa para cotizaciones y facturas.' },
  {
    clave: 'dominio_publico',
    etiqueta: 'Dominio de la página de venta',
    tipo: 'texto',
    pista: 'Por ejemplo finanvoz.com. Vacío mientras no haya dominio.',
  },
];

function aTexto(tipo: Tipo, valor: unknown): string {
  if (tipo === 'texto') return typeof valor === 'string' ? valor : '';
  const n = typeof valor === 'number' ? valor : 0;
  return pesosDeCentavos(n); // pesos: centavos → pesos; porcentaje: puntos base → %, misma regla de 2 decimales
}

function aValor(tipo: Tipo, texto: string): number | string | null {
  if (tipo === 'texto') return texto.trim().toLowerCase();
  return centavosDePesos(texto);
}

export function Ajustes({ datos, sesion }: { datos: CapaDatos; sesion: SesionAdmin }) {
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [originales, setOriginales] = useState<Record<string, string>>({});
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setEstado('cargando');
    const r = await datos.listarParametros();
    if (!r.ok) {
      setError(r.error);
      setEstado('error');
      return;
    }
    const porClave = new Map<string, Parametro>(r.datos.map((p) => [p.clave, p]));
    const map: Record<string, string> = {};
    for (const a of AJUSTES) map[a.clave] = aTexto(a.tipo, porClave.get(a.clave)?.valor);
    setOriginales(map);
    setValores(map);
    setEstado('ok');
  }, [datos]);

  useEffect(() => {
    if (sesion.rol === 'dueno') void cargar();
  }, [cargar, sesion.rol]);

  if (sesion.rol !== 'dueno')
    return (
      <>
        <Cabecera titulo="Ajustes" porque="Precios, comisiones e impuestos del negocio" />
        <SinPermiso />
      </>
    );

  const cambiados = AJUSTES.filter((a) => valores[a.clave] !== originales[a.clave]);
  const invalidos = cambiados.filter((a) => aValor(a.tipo, valores[a.clave] ?? '') === null);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (invalidos.length > 0) return;
    setGuardando(true);
    setAviso('');
    for (const a of cambiados) {
      const r = await datos.guardarParametro(a.clave, aValor(a.tipo, valores[a.clave] ?? ''));
      if (!r.ok) {
        setAviso(r.error);
        setGuardando(false);
        return;
      }
    }
    setGuardando(false);
    setAviso(cambiados.length === 1 ? 'Guardé 1 ajuste.' : `Guardé ${cambiados.length} ajustes.`);
    await cargar();
  }

  return (
    <>
      <Cabecera
        titulo="Ajustes"
        porque="Precios, comisiones e impuestos del negocio. Son valores iniciales: ajústalos a los reales."
      />
      {estado === 'cargando' ? (
        <Cargando filas={6} />
      ) : estado === 'error' ? (
        <ErrorCarga mensaje={error} onReintentar={() => void cargar()} />
      ) : (
        <form className="panel panel-cuerpo panel-formulario" onSubmit={guardar}>
          {AJUSTES.map((a) => {
            const malo = invalidos.includes(a);
            return (
              <div className="campo" key={a.clave}>
                <label htmlFor={`p-${a.clave}`}>
                  {a.etiqueta}
                  {a.tipo === 'pesos' ? ' ($)' : a.tipo === 'porcentaje' ? ' (%)' : ''}
                </label>
                <input
                  id={`p-${a.clave}`}
                  inputMode={a.tipo === 'texto' ? 'url' : 'decimal'}
                  value={valores[a.clave] ?? ''}
                  aria-invalid={malo || undefined}
                  aria-describedby={`p-${a.clave}-pista`}
                  onChange={(e) => setValores((v) => ({ ...v, [a.clave]: e.target.value }))}
                />
                <span id={`p-${a.clave}-pista`} className={malo ? 'error-campo' : 'pista'}>
                  {malo ? 'Escribe un número, con hasta dos decimales.' : a.pista}
                </span>
              </div>
            );
          })}
          {aviso ? (
            <p className="aviso-demo" role="status">
              {aviso}
            </p>
          ) : null}
          <div className="hoja-acciones">
            <button
              type="submit"
              className="btn btn-primario"
              disabled={cambiados.length === 0 || invalidos.length > 0 || guardando}
            >
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
