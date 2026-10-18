import type { ReactNode } from 'react';
import { View } from 'react-native';
import { UMBRAL_USO_BP } from '@cartera/core';
import {
  etiquetaFecha,
  fijarApartarDeuda,
  listarCuentas,
  listarTarjetas,
  type CuentaDebes,
  type TarjetaVista,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import {
  Barra,
  Boton,
  Cifra,
  espacio,
  formatearCentavos,
  Interruptor,
  Pantalla,
  Tarjeta,
  Texto,
} from '../../ui';
import { BTN_COMPARTIDOS_CUENTAS } from '../compartido/textos';
import { BTN_DEDUCCIONES_CUENTAS } from '../deducciones/textos';
import { BTN_TANDAS_CUENTAS } from '../tandas/textos';
import { BTN_SUSCRIPCIONES_CUENTAS } from '../suscripciones/textos';
import { EstadoVacio } from './EstadoVacio';
import {
  BTN_AGREGAR_TARJETA_CREDITO,
  BTN_AJUSTES_CUENTAS,
  BTN_AJUSTES_CUENTAS_ACCESIBLE,
  contextoSaldoCompromiso,
  contextoSaldoLeDebes,
  contextoSaldoTarjeta,
  contextoSaldoTeDebe,
  contextoSaldoTienes,
  SUBTITULO_CUENTAS_COMPROMISOS,
  TEXTO_CUENTAS_COMPROMISOS_VACIO,
  TEXTO_CUENTAS_DEBES_VACIO,
  TEXTO_CUENTAS_TIENES_VACIO,
  etiquetaVacioCuentasCompromisos,
  etiquetaVacioCuentasDebes,
  etiquetaVacioCuentasTienes,
} from './textos';

const NOMBRE_SUBTIPO: Record<string, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  billetera: 'Billetera',
  ahorro: 'Ahorro',
};

/**
 * Cuentas (02-UX §11): Tienes · Debes · Te deben · Compromisos (próximos 30 días). Engrane → Ajustes. Cada tarjeta
 * de crédito abre su detalle (02-UX §8).
 */
export function PantallaCuentas({
  alAbrirAjustes,
  alAbrirTarjeta,
  alAgregarTarjeta,
  alContarEfectivo,
  alAbrirPersona,
  alAbrirTandas,
  alAbrirCompartidos,
  alAbrirSuscripciones,
  alAbrirDeducciones,
}: {
  alAbrirAjustes: () => void;
  /** Te deben → detalle de la persona con Cobrar (`02 §17`). */
  alAbrirPersona?: (personaId: string) => void;
  alAbrirTarjeta?: (tarjetaId: string) => void;
  alAgregarTarjeta?: () => void;
  /** Cuentas → Efectivo → arqueo (`02 §7`). */
  alContarEfectivo?: (cuentaId: string) => void;
  /** Cuentas → Tandas (`02 §18`). */
  alAbrirTandas?: () => void;
  /** Cuentas → Gastos compartidos (`02 §27`, M16). */
  alAbrirCompartidos?: () => void;
  /** Cuentas → Suscripciones (`02 §20`). */
  alAbrirSuscripciones?: () => void;
  /** Personal → Deducciones (`02 §24`): sin negocio, el espacio personal es Cuentas. */
  alAbrirDeducciones?: () => void;
}) {
  const v = useVista(listarCuentas);
  const tarjetas = useVista(listarTarjetas);
  return (
    <Pantalla testID="pantalla-cuentas">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: espacio.s,
        }}
      >
        <Texto variante="titulo" testID="cuentas-titulo" accessibilityRole="header">
          Cuentas
        </Texto>
        <Boton
          etiqueta={BTN_AJUSTES_CUENTAS}
          etiquetaAccesible={BTN_AJUSTES_CUENTAS_ACCESIBLE}
          variante="texto"
          ancho="contenido"
          alPresionar={alAbrirAjustes}
          testID="boton-ajustes"
        />
      </View>

      <Seccion titulo="Tienes" testID="seccion-tienes">
        {v.tienes.length === 0 ? (
          <EstadoVacio
            texto={TEXTO_CUENTAS_TIENES_VACIO}
            testID="cuentas-tienes-vacio"
            etiquetaAccesible={etiquetaVacioCuentasTienes()}
          />
        ) : null}
        {v.tienes.map((c) => (
          <Fila
            key={c.id}
            testID={`cuenta-${c.id}`}
            titulo={c.nombre}
            subtitulo={NOMBRE_SUBTIPO[c.subtipo] ?? null}
            centavos={c.saldo}
            contextoSaldo={contextoSaldoTienes(c.nombre)}
            {...(c.subtipo === 'efectivo' && alContarEfectivo
              ? {
                  accion: {
                    etiqueta: 'Contar mi efectivo',
                    etiquetaAccesible: `Contar mi efectivo en ${c.nombre}`,
                    alPresionar: () => alContarEfectivo(c.id),
                  },
                }
              : {})}
          />
        ))}
      </Seccion>

      <Seccion titulo="Debes" testID="seccion-debes">
        {v.debes.length === 0 ? (
          <EstadoVacio
            texto={TEXTO_CUENTAS_DEBES_VACIO}
            testID="cuentas-debes-vacio"
            etiquetaAccesible={etiquetaVacioCuentasDebes()}
          />
        ) : null}
        {v.debes.map((d) =>
          d.tipo === 'tarjeta' ? (
            <TarjetaCredito
              key={d.id}
              d={d}
              t={tarjetas.find((t) => t.id === d.id) ?? null}
              {...(alAbrirTarjeta ? { alAbrir: () => alAbrirTarjeta(d.id) } : {})}
            />
          ) : (
            <PersonaDebes
              key={d.id}
              d={d}
              {...(alAbrirPersona ? { alAbrirPersona } : {})}
            />
          ),
        )}
        {alAgregarTarjeta ? (
          <Boton
            etiqueta="Agregar tarjeta de crédito"
            variante="texto"
            ancho="contenido"
            alPresionar={alAgregarTarjeta}
            testID="boton-agregar-tarjeta"
          />
        ) : null}
      </Seccion>

      {v.teDeben.length > 0 ? (
        <Seccion titulo="Te deben" testID="seccion-te-deben">
          {v.teDeben.map((p) => (
            <Fila
              key={p.id}
              testID={`te-debe-${p.id}`}
              titulo={p.nombre}
              subtitulo={null}
              centavos={p.saldo}
              contextoSaldo={contextoSaldoTeDebe(p.nombre)}
              {...(alAbrirPersona
                ? {
                    accion: {
                      etiqueta: 'Cobrar',
                      etiquetaAccesible: `Cobrar a ${p.nombre}`,
                      alPresionar: () => alAbrirPersona(p.id),
                    },
                  }
                : {})}
            />
          ))}
        </Seccion>
      ) : null}

      <Seccion titulo="Compromisos" subtitulo={SUBTITULO_CUENTAS_COMPROMISOS} testID="seccion-compromisos">
        {v.compromisos.length === 0 ? (
          <EstadoVacio
            texto={TEXTO_CUENTAS_COMPROMISOS_VACIO}
            testID="cuentas-compromisos-vacio"
            etiquetaAccesible={etiquetaVacioCuentasCompromisos()}
          />
        ) : null}
        {v.compromisos.map((c) => (
          <Fila
            key={`${c.programadoId}:${c.fecha}`}
            testID={`compromiso-${c.programadoId}`}
            titulo={c.concepto}
            subtitulo={etiquetaFecha(c.fecha)}
            centavos={c.monto}
            contextoSaldo={contextoSaldoCompromiso(c.concepto, etiquetaFecha(c.fecha))}
          />
        ))}
      </Seccion>

      {alAbrirTandas ? (
        <Seccion titulo="Tandas" testID="seccion-tandas">
          <Boton
            etiqueta={BTN_TANDAS_CUENTAS}
            variante="secundario"
            alPresionar={alAbrirTandas}
            testID="boton-tandas"
          />
        </Seccion>
      ) : null}

      {alAbrirCompartidos ? (
        <Seccion titulo="Gastos compartidos" testID="seccion-compartidos">
          <Boton
            etiqueta={BTN_COMPARTIDOS_CUENTAS}
            variante="secundario"
            alPresionar={alAbrirCompartidos}
            testID="boton-compartidos"
          />
        </Seccion>
      ) : null}

      {alAbrirSuscripciones ? (
        <Seccion titulo="Suscripciones" testID="seccion-suscripciones">
          <Boton
            etiqueta={BTN_SUSCRIPCIONES_CUENTAS}
            variante="secundario"
            alPresionar={alAbrirSuscripciones}
            testID="boton-suscripciones"
          />
        </Seccion>
      ) : null}

      {alAbrirDeducciones ? (
        <Seccion titulo="Deducciones" testID="seccion-deducciones">
          <Boton
            etiqueta={BTN_DEDUCCIONES_CUENTAS}
            variante="secundario"
            alPresionar={alAbrirDeducciones}
            testID="boton-deducciones"
          />
        </Seccion>
      ) : null}
    </Pantalla>
  );
}

function Seccion({
  titulo,
  subtitulo,
  children,
  testID,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  testID: string;
}) {
  return (
    <View style={{ gap: espacio.s }} testID={testID}>
      <Texto variante="subtitulo" testID={`${testID}-titulo`} accessibilityRole="header">
        {titulo}
      </Texto>
      {subtitulo ? (
        <Texto variante="secundario" tono="secundario" testID={`${testID}-subtitulo`}>
          {subtitulo}
        </Texto>
      ) : null}
      {children}
    </View>
  );
}

function Fila({
  titulo,
  subtitulo,
  centavos,
  contextoSaldo,
  testID,
  accion,
}: {
  titulo: string;
  subtitulo: string | null;
  centavos: number;
  contextoSaldo: string;
  testID?: string;
  accion?: { etiqueta: string; etiquetaAccesible?: string; alPresionar: () => void };
}) {
  return (
    <Tarjeta {...(testID ? { testID } : {})}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
        <View style={{ flex: 1, gap: espacio.xxs }}>
          <Texto variante="cuerpoFuerte">{titulo}</Texto>
          {subtitulo ? (
            <Texto variante="secundario" tono="secundario">
              {subtitulo}
            </Texto>
          ) : null}
        </View>
        <Cifra
          centavos={centavos}
          contexto={contextoSaldo}
          {...(testID ? { testID: `${testID}-saldo` } : {})}
        />
      </View>
      {accion ? (
        <Boton
          etiqueta={accion.etiqueta}
          variante="texto"
          ancho="contenido"
          alPresionar={accion.alPresionar}
          {...(accion.etiquetaAccesible ? { etiquetaAccesible: accion.etiquetaAccesible } : {})}
          {...(testID ? { testID: `${testID}-accion` } : {})}
        />
      ) : null}
    </Tarjeta>
  );
}

function TarjetaCredito({ d, t, alAbrir }: { d: CuentaDebes; t: TarjetaVista | null; alAbrir?: () => void }) {
  const aFavor = d.saldo < 0;
  return (
    <Tarjeta
      testID={`cuenta-${d.id}`}
      {...(alAbrir
        ? { alPresionar: alAbrir, etiquetaAccesible: d.nombre, pista: 'Abre el detalle de la tarjeta' }
        : {})}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
        <View style={{ flex: 1, gap: espacio.xxs }}>
          <Texto variante="cuerpoFuerte">{d.nombre}</Texto>
          <Texto variante="secundario" tono="secundario">
            {aFavor ? 'Saldo a favor' : 'Tarjeta de crédito'}
          </Texto>
        </View>
        <Cifra
          centavos={aFavor ? -d.saldo : d.saldo}
          contexto={contextoSaldoTarjeta(d.nombre, aFavor)}
          testID={`cuenta-${d.id}-saldo`}
        />
      </View>
      {d.meses > 0 ? (
        <Texto variante="secundario" testID={`cuenta-${d.id}-meses`}>
          {`Meses sin intereses que faltan: ${formatearCentavos(d.meses)}`}
        </Texto>
      ) : null}
      {aFavor ? (
        <Texto variante="secundario" tono="secundario">
          No se suma a tu dinero libre.
        </Texto>
      ) : null}
      {t && t.pngi > 0 ? (
        <Texto variante="secundario" testID={`cuenta-${d.id}-pngi`}>
          {`Para no generar intereses: ${formatearCentavos(t.pngi)} antes del ${t.etiquetaFechaLimite}`}
        </Texto>
      ) : t ? (
        <Texto variante="secundario" tono="secundario" testID={`cuenta-${d.id}-limite-pago`}>
          {`Fecha límite: ${t.etiquetaFechaLimite} · próximo corte: ${t.etiquetaProximoCorte}`}
        </Texto>
      ) : null}
      {t ? (
        <>
          <Barra
            llenoBp={t.usoBp}
            marcaBp={UMBRAL_USO_BP}
            etiquetaAccesible={`Usas ${t.usoPorcentaje} % de tu límite`}
          />
          <Texto variante="secundario" tono="secundario">
            {`Usas ${t.usoPorcentaje} % de tu límite de ${formatearCentavos(t.limiteCredito)}`}
          </Texto>
        </>
      ) : d.limiteCredito !== null ? (
        <Texto variante="secundario" tono="secundario">
          {`Límite: ${formatearCentavos(d.limiteCredito)}`}
        </Texto>
      ) : null}
    </Tarjeta>
  );
}

/** Persona a la que le debes con "Apartar lo que le debo" (E4, CA-M2-09). */
function PersonaDebes({
  d,
  alAbrirPersona,
}: {
  d: CuentaDebes;
  alAbrirPersona?: (personaId: string) => void;
}) {
  const { ctx, refrescar } = useSesion();
  return (
    <Tarjeta testID={`cuenta-${d.id}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
        <View style={{ flex: 1, gap: espacio.xxs }}>
          <Texto variante="cuerpoFuerte">{d.nombre}</Texto>
          <Texto variante="secundario" tono="secundario">
            Le debes
          </Texto>
        </View>
        <Cifra
          centavos={d.saldo}
          contexto={contextoSaldoLeDebes(d.nombre)}
          testID={`cuenta-${d.id}-saldo`}
        />
      </View>
      {alAbrirPersona ? (
        <Boton
          etiqueta="Ver"
          etiquetaAccesible={`Ver ${d.nombre}`}
          pista="Abre el detalle de la persona"
          variante="texto"
          ancho="contenido"
          alPresionar={() => alAbrirPersona(d.id)}
          testID={`cuenta-${d.id}-accion`}
        />
      ) : null}
      <Interruptor
        etiqueta="Apartar lo que le debo"
        descripcion={
          d.apartar
            ? 'Lo que le debes no cuenta como dinero libre.'
            : 'Lo que le debes cuenta como dinero libre.'
        }
        valor={d.apartar === true}
        alCambiar={(valor) => {
          fijarApartarDeuda(ctx, d.id, valor);
          refrescar();
        }}
        testID={`apartar-${d.id}`}
      />
    </Tarjeta>
  );
}
