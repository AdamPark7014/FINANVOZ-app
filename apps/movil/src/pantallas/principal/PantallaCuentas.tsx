import type { ReactNode } from 'react';
import { View } from 'react-native';
import {
  etiquetaFecha,
  fijarApartarDeuda,
  listarCuentas,
  listarPersonas,
  listarTarjetas,
  type CuentaDebes,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, Cifra, espacio, Interruptor, Pantalla, Tarjeta, Texto } from '../../ui';
import { etiquetaContarEnCuenta, TITULO as TITULO_CONTAR_EFECTIVO } from '../arqueo/textos';
import { BTN_COMPARTIDOS_CUENTAS } from '../compartido/textos';
import {
  BTN_AGREGAR_CUENTA,
  BTN_AGREGAR_PAGO_FIJO,
  BTN_VER,
  BTN_VER_PAGOS_FIJOS,
  BTN_VER_PERSONAS,
  etiquetaFila,
  etiquetaVerCuenta,
  PISTA_ABRIR_COMPROMISO,
  PISTA_ABRIR_CUENTA,
  PISTA_ABRIR_EFECTIVO,
  PISTA_AGREGAR_CUENTA,
  PISTA_AGREGAR_PAGO_FIJO,
  PISTA_CTA_AGREGAR_CUENTA,
  PISTA_VER_PAGOS_FIJOS,
  PISTA_VER_PERSONAS,
} from '../cuentas/textos';
import { BTN_DEDUCCIONES_CUENTAS } from '../deducciones/textos';
import { BTN_TANDAS_CUENTAS } from '../tandas/textos';
import { BTN_SUSCRIPCIONES_CUENTAS } from '../suscripciones/textos';
import { TarjetaCreditoLista } from '../tarjetas/TarjetaCreditoLista';
import { EstadoVacio } from './EstadoVacio';
import {
  BTN_AGREGAR_TARJETA_CREDITO,
  BTN_AJUSTES_CUENTAS,
  BTN_AJUSTES_CUENTAS_ACCESIBLE,
  PISTA_AGREGAR_TARJETA_CREDITO,
  PISTA_COBRAR_DESDE_CUENTAS,
  PISTA_CONTAR_EFECTIVO,
  contextoSaldoCompromiso,
  contextoSaldoLeDebes,
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
 * de crédito abre su detalle (02-UX §8); cada cuenta de Tienes, el suyo (corregir saldo, ver movimientos); cada
 * compromiso, el del pago fijo (cambiar monto, quitar). «Agregar cuenta» y «Agregar pago fijo» cumplen lo que el
 * onboarding promete («agrégalas después en Cuentas»).
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
  alAgregarCuenta,
  alAbrirCuenta,
  alAgregarPagoFijo,
  alAbrirPagoFijo,
  alVerPagosFijos,
  alVerPersonas,
}: {
  alAbrirAjustes: () => void;
  /** Te deben → detalle de la persona con Cobrar (`02 §17`). */
  alAbrirPersona?: (personaId: string) => void;
  alAbrirTarjeta?: (tarjetaId: string) => void;
  alAgregarTarjeta?: () => void;
  /** Cuentas → Efectivo → arqueo (`02 §7`). */
  alContarEfectivo?: (cuentaId: string) => void;
  /** Tienes → Agregar cuenta (débito, billetera o ahorro). */
  alAgregarCuenta?: () => void;
  /** Tienes → detalle de la cuenta (corregir saldo, ver movimientos). */
  alAbrirCuenta?: (cuentaId: string) => void;
  /** Compromisos → Agregar pago fijo. */
  alAgregarPagoFijo?: () => void;
  /** Compromisos → detalle del pago (cambiar monto, quitar). */
  alAbrirPagoFijo?: (programadoId: string) => void;
  /** Compromisos → todos los pagos fijos (también los que caen en más de 30 días). */
  alVerPagosFijos?: () => void;
  /** Personas → lista completa (también con las que estás a mano). */
  alVerPersonas?: () => void;
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
  const hayPersonas = useVista((ctx) => listarPersonas(ctx).length > 0);
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
          pista="Abre la pantalla de Ajustes"
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
            {...(alAgregarCuenta ? { pistaCta: PISTA_CTA_AGREGAR_CUENTA } : {})}
          />
        ) : null}
        {v.tienes.length > 0 ? (
          <View accessibilityRole="list" testID="seccion-tienes-lista" style={{ gap: espacio.s }}>
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
                        etiqueta: TITULO_CONTAR_EFECTIVO,
                        etiquetaAccesible: etiquetaContarEnCuenta(c.nombre),
                        pista: PISTA_CONTAR_EFECTIVO,
                        alPresionar: () => alContarEfectivo(c.id),
                      },
                    }
                  : {})}
                {...(alAbrirCuenta
                  ? {
                      abrir: {
                        etiquetaVer: etiquetaVerCuenta(c.nombre),
                        pista: c.subtipo === 'efectivo' ? PISTA_ABRIR_EFECTIVO : PISTA_ABRIR_CUENTA,
                        alPresionar: () => alAbrirCuenta(c.id),
                      },
                    }
                  : {})}
              />
            ))}
          </View>
        ) : null}
        {alAgregarCuenta ? (
          <Boton
            etiqueta={BTN_AGREGAR_CUENTA}
            pista={PISTA_AGREGAR_CUENTA}
            variante="texto"
            ancho="contenido"
            alPresionar={alAgregarCuenta}
            testID="boton-agregar-cuenta"
          />
        ) : null}
      </Seccion>

      <Seccion titulo="Debes" testID="seccion-debes">
        {v.debes.length === 0 ? (
          <EstadoVacio
            texto={TEXTO_CUENTAS_DEBES_VACIO}
            testID="cuentas-debes-vacio"
            etiquetaAccesible={etiquetaVacioCuentasDebes()}
            {...(alAgregarTarjeta
              ? { pistaCta: `Más abajo, botón ${BTN_AGREGAR_TARJETA_CREDITO.toLowerCase()}` }
              : {})}
          />
        ) : null}
        {v.debes.length > 0 ? (
          <View accessibilityRole="list" testID="seccion-debes-lista" style={{ gap: espacio.s }}>
            {v.debes.map((d) =>
              d.tipo === 'tarjeta' ? (
                <View key={d.id} role="listitem">
                  <TarjetaCreditoLista
                    d={d}
                    t={tarjetas.find((t) => t.id === d.id) ?? null}
                    {...(alAbrirTarjeta ? { alAbrir: () => alAbrirTarjeta(d.id) } : {})}
                  />
                </View>
              ) : (
                <View key={d.id} role="listitem">
                  <PersonaDebes d={d} {...(alAbrirPersona ? { alAbrirPersona } : {})} />
                </View>
              ),
            )}
          </View>
        ) : null}
        {alAgregarTarjeta ? (
          <Boton
            etiqueta={BTN_AGREGAR_TARJETA_CREDITO}
            pista={PISTA_AGREGAR_TARJETA_CREDITO}
            variante="texto"
            ancho="contenido"
            alPresionar={alAgregarTarjeta}
            testID="boton-agregar-tarjeta"
          />
        ) : null}
      </Seccion>

      {v.teDeben.length > 0 ? (
        <Seccion titulo="Te deben" testID="seccion-te-deben">
          <View accessibilityRole="list" testID="seccion-te-deben-lista" style={{ gap: espacio.s }}>
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
                        pista: PISTA_COBRAR_DESDE_CUENTAS,
                        alPresionar: () => alAbrirPersona(p.id),
                      },
                    }
                  : {})}
              />
            ))}
          </View>
        </Seccion>
      ) : null}

      {alVerPersonas && hayPersonas ? (
        <Boton
          etiqueta={BTN_VER_PERSONAS}
          pista={PISTA_VER_PERSONAS}
          variante="texto"
          ancho="contenido"
          alPresionar={alVerPersonas}
          testID="boton-ver-personas"
        />
      ) : null}

      <Seccion
        titulo="Compromisos"
        subtitulo={SUBTITULO_CUENTAS_COMPROMISOS}
        tituloAccesible={`Compromisos, ${SUBTITULO_CUENTAS_COMPROMISOS.toLowerCase()}`}
        testID="seccion-compromisos"
      >
        {v.compromisos.length === 0 ? (
          <EstadoVacio
            texto={TEXTO_CUENTAS_COMPROMISOS_VACIO}
            testID="cuentas-compromisos-vacio"
            etiquetaAccesible={etiquetaVacioCuentasCompromisos()}
          />
        ) : null}
        {v.compromisos.length > 0 ? (
          <View accessibilityRole="list" testID="seccion-compromisos-lista" style={{ gap: espacio.s }}>
            {v.compromisos.map((c) => (
              <Fila
                key={`${c.programadoId}:${c.fecha}`}
                testID={`compromiso-${c.programadoId}`}
                titulo={c.concepto}
                subtitulo={etiquetaFecha(c.fecha)}
                centavos={c.monto}
                contextoSaldo={contextoSaldoCompromiso(c.concepto, etiquetaFecha(c.fecha))}
                {...(alAbrirPagoFijo
                  ? {
                      abrir: {
                        pista: PISTA_ABRIR_COMPROMISO,
                        alPresionar: () => alAbrirPagoFijo(c.programadoId),
                      },
                    }
                  : {})}
              />
            ))}
          </View>
        ) : null}
        {alAgregarPagoFijo || alVerPagosFijos ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
            {alAgregarPagoFijo ? (
              <Boton
                etiqueta={BTN_AGREGAR_PAGO_FIJO}
                pista={PISTA_AGREGAR_PAGO_FIJO}
                variante="texto"
                ancho="contenido"
                alPresionar={alAgregarPagoFijo}
                testID="boton-agregar-pago-fijo"
              />
            ) : null}
            {alVerPagosFijos ? (
              <Boton
                etiqueta={BTN_VER_PAGOS_FIJOS}
                pista={PISTA_VER_PAGOS_FIJOS}
                variante="texto"
                ancho="contenido"
                alPresionar={alVerPagosFijos}
                testID="boton-ver-pagos-fijos"
              />
            ) : null}
          </View>
        ) : null}
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
  tituloAccesible,
  children,
  testID,
}: {
  titulo: string;
  subtitulo?: string;
  /** TalkBack: título y subtítulo en una sola frase (`02 §15`). */
  tituloAccesible?: string;
  children: ReactNode;
  testID: string;
}) {
  return (
    <View style={{ gap: espacio.s }} testID={testID}>
      <Texto
        variante="subtitulo"
        testID={`${testID}-titulo`}
        accessibilityRole="header"
        {...(tituloAccesible ? { accessibilityLabel: tituloAccesible } : {})}
      >
        {titulo}
      </Texto>
      {subtitulo ? (
        <Texto
          variante="secundario"
          tono="secundario"
          testID={`${testID}-subtitulo`}
          {...(tituloAccesible
            ? {
                accessibilityElementsHidden: true,
                importantForAccessibility: 'no-hide-descendants',
              }
            : {})}
        >
          {subtitulo}
        </Texto>
      ) : null}
      {children}
    </View>
  );
}

/**
 * Fila de Tienes, Te deben o Compromisos. Con `abrir` y sin otros botones, toda la tarjeta es un solo botón (el
 * lector oye nombre, detalle y cifra en palabras); con `accion` (Contar mi efectivo, Cobrar) aparece además «Ver»
 * junto a ella, para no anidar botones dentro de otro.
 */
function Fila({
  titulo,
  subtitulo,
  centavos,
  contextoSaldo,
  testID,
  accion,
  abrir,
}: {
  titulo: string;
  subtitulo: string | null;
  centavos: number;
  contextoSaldo: string;
  testID?: string;
  accion?: { etiqueta: string; etiquetaAccesible?: string; pista?: string; alPresionar: () => void };
  abrir?: { pista: string; alPresionar: () => void; etiquetaVer?: string };
}) {
  const contenido = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flex: 1, gap: espacio.xxs }}
      >
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
  );
  const botonAccion = accion ? (
    <Boton
      etiqueta={accion.etiqueta}
      variante="texto"
      ancho="contenido"
      alPresionar={accion.alPresionar}
      {...(accion.etiquetaAccesible ? { etiquetaAccesible: accion.etiquetaAccesible } : {})}
      {...(accion.pista ? { pista: accion.pista } : {})}
      {...(testID ? { testID: `${testID}-accion` } : {})}
    />
  ) : null;

  if (abrir && !accion) {
    return (
      <View role="listitem" {...(testID ? { testID } : {})}>
        <Tarjeta
          alPresionar={abrir.alPresionar}
          etiquetaAccesible={etiquetaFila({ titulo, subtitulo, contexto: contextoSaldo, centavos })}
          pista={abrir.pista}
          {...(testID ? { testID: `${testID}-abrir` } : {})}
        >
          {contenido}
        </Tarjeta>
      </View>
    );
  }

  return (
    <View role="listitem" {...(testID ? { testID } : {})}>
      <Tarjeta>
        {contenido}
        {abrir ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
            {botonAccion}
            <Boton
              etiqueta={BTN_VER}
              variante="texto"
              ancho="contenido"
              alPresionar={abrir.alPresionar}
              pista={abrir.pista}
              {...(abrir.etiquetaVer ? { etiquetaAccesible: abrir.etiquetaVer } : {})}
              {...(testID ? { testID: `${testID}-ver` } : {})}
            />
          </View>
        ) : (
          botonAccion
        )}
      </Tarjeta>
    </View>
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
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flex: 1, gap: espacio.xxs }}
        >
          <Texto variante="cuerpoFuerte">{d.nombre}</Texto>
          <Texto variante="secundario" tono="secundario">
            Le debes
          </Texto>
        </View>
        <Cifra centavos={d.saldo} contexto={contextoSaldoLeDebes(d.nombre)} testID={`cuenta-${d.id}-saldo`} />
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
