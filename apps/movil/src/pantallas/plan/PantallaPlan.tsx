import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { obtenerPlan, sincronizarPlan, type EstadoTienda } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { usePlanTienda } from '../../suscripciones/ProveedorPlan';
import type { OfertaPlus } from '../../suscripciones/tipos';
import { Boton, espacio, Pantalla, Tarjeta, Texto } from '../../ui';
import {
  CARGANDO_OFERTAS,
  etiquetaOferta,
  ETIQUETA_ADMINISTRAR,
  ETIQUETA_INTENTAR,
  ETIQUETA_RESTAURAR,
  ETIQUETA_VER_PLANES,
  ETIQUETA_VOLVER,
  esMensajeErrorPlan,
  etiquetaAccesibleBeneficioPlus,
  etiquetaAccesibleIncluyeGratis,
  etiquetaAccesibleMensajePlan,
  etiquetaAccesibleOfertaDetalle,
  etiquetaAccesibleResumenPlan,
  PISTA_ADMINISTRAR,
  PISTA_INTENTAR,
  PISTA_RESTAURAR,
  PISTA_VER_PLANES,
  PISTA_VOLVER,
  pistaComprarOferta,
  ID,
  INCLUYE_GRATIS,
  INCLUYE_PLUS,
  MENSAJE_ERROR_COMPRA,
  MENSAJE_ERROR_OFERTAS,
  MENSAJE_LISTO,
  MENSAJE_OFERTAS_VACIAS,
  MENSAJE_PENDIENTE,
  MENSAJE_RESTAURADO_SIN_PLUS,
  MENSAJE_SIN_TIENDA,
  NOTA_COMPRA_SIMULADA,
  NOTA_TIENDA,
  resumenPlan,
  SECCION_AJUSTES,
  SECCION_INCLUYE,
  TITULO_PANTALLA,
} from './textos';

type Ofertas = { tipo: 'cargando' } | { tipo: 'listas'; ofertas: readonly OfertaPlus[] } | { tipo: 'error' };

/**
 * Plan (RF-PAG-01, `01 §11`, `02 §12`): qué incluye Plus, la prueba de 14 días y los precios que da Google Play.
 * Comprar y restaurar pasan por el adaptador de compras; el plan se guarda con `sincronizarPlan` y todas las
 * vistas se refrescan. En Gratis nada se bloquea: aquí solo se ofrece el análisis de Plus.
 */
export function PantallaPlan({ alVolver }: { alVolver: () => void }) {
  const { ctx, refrescar } = useSesion();
  const { compras } = usePlanTienda();
  const vista = useVista(obtenerPlan);
  const [ofertas, setOfertas] = useState<Ofertas>({ tipo: 'cargando' });
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const resumen = resumenPlan(vista);

  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!compras) return;
    let vigente = true;
    compras.ofertas().then(
      (o) => vigente && setOfertas({ tipo: 'listas', ofertas: o }),
      () => vigente && setOfertas({ tipo: 'error' }),
    );
    return () => {
      vigente = false;
    };
  }, [compras, intento]);

  const cargar = () => {
    setOfertas({ tipo: 'cargando' });
    setIntento((i) => i + 1);
  };

  const guardar = (estado: EstadoTienda) => {
    sincronizarPlan(ctx, estado);
    refrescar();
  };

  const comprar = async (id: string) => {
    if (!compras) return;
    setOcupado(id);
    setMensaje(null);
    try {
      const r = await compras.comprar(id);
      if (r.tipo === 'comprado') {
        guardar(r.estado);
        setMensaje(r.estado.plus ? MENSAJE_LISTO : MENSAJE_PENDIENTE);
      } else if (r.tipo === 'pendiente') setMensaje(MENSAJE_PENDIENTE);
      else if (r.tipo === 'error') setMensaje(MENSAJE_ERROR_COMPRA);
    } catch {
      setMensaje(MENSAJE_ERROR_COMPRA);
    } finally {
      setOcupado(null);
    }
  };

  const restaurar = async () => {
    if (!compras) return;
    setOcupado('restaurar');
    setMensaje(null);
    try {
      const estado = await compras.restaurar();
      guardar(estado);
      setMensaje(estado.plus ? MENSAJE_LISTO : MENSAJE_RESTAURADO_SIN_PLUS);
    } catch {
      setMensaje(MENSAJE_ERROR_OFERTAS);
    } finally {
      setOcupado(null);
    }
  };

  return (
    <Pantalla testID={ID.pantalla} bordes={['top', 'left', 'right', 'bottom']}>
      <Boton
        etiqueta={ETIQUETA_VOLVER}
        variante="texto"
        ancho="contenido"
        alPresionar={alVolver}
        pista={PISTA_VOLVER}
        testID={ID.volver}
      />
      <Texto testID={ID.tituloPantalla} variante="titulo" accessibilityRole="header">
        {TITULO_PANTALLA}
      </Texto>

      <Tarjeta testID={ID.actual}>
        <Texto
          variante="subtitulo"
          testID={ID.titulo}
          accessibilityLabel={etiquetaAccesibleResumenPlan(resumen.titulo, resumen.detalle)}
        >
          {resumen.titulo}
        </Texto>
        {resumen.detalle ? (
          <Texto
            variante="cuerpo"
            tono="secundario"
            testID={ID.detalle}
            importantForAccessibility="no"
          >
            {resumen.detalle}
          </Texto>
        ) : null}
        {vista.plan === 'plus' && compras ? (
          <Boton
            etiqueta={ETIQUETA_ADMINISTRAR}
            variante="secundario"
            alPresionar={() => void compras.administrar().catch(() => undefined)}
            pista={PISTA_ADMINISTRAR}
            testID={ID.administrar}
          />
        ) : null}
      </Tarjeta>

      <Tarjeta testID={ID.incluye}>
        <Texto variante="subtitulo">{SECCION_INCLUYE}</Texto>
        <View accessibilityRole="list" style={{ gap: espacio.xs }}>
          {INCLUYE_PLUS.map((t) => (
            <Texto
              key={t}
              variante="cuerpo"
              accessibilityRole="listitem"
              accessibilityLabel={etiquetaAccesibleBeneficioPlus(t)}
            >{`• ${t}`}</Texto>
          ))}
        </View>
        <Texto
          variante="secundario"
          tono="secundario"
          accessibilityLabel={etiquetaAccesibleIncluyeGratis()}
        >
          {INCLUYE_GRATIS}
        </Texto>
      </Tarjeta>

      {vista.plan === 'gratis' ? (
        <View style={{ gap: espacio.m }}>
          {!compras ? (
            <Texto variante="cuerpo" tono="secundario" testID={ID.sinTienda}>
              {MENSAJE_SIN_TIENDA}
            </Texto>
          ) : ofertas.tipo === 'cargando' ? (
            <Texto
              variante="secundario"
              tono="secundario"
              accessibilityLiveRegion="polite"
              testID={ID.cargando}
            >
              {CARGANDO_OFERTAS}
            </Texto>
          ) : ofertas.tipo === 'error' ? (
            <>
              <Texto
                variante="cuerpo"
                tono="faltante"
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                importantForAccessibility="yes"
                testID={ID.errorOfertas}
              >
                {MENSAJE_ERROR_OFERTAS}
              </Texto>
              <Boton
                etiqueta={ETIQUETA_INTENTAR}
                variante="secundario"
                alPresionar={cargar}
                pista={PISTA_INTENTAR}
                testID={ID.intentar}
              />
            </>
          ) : ofertas.ofertas.length === 0 ? (
            <>
              <Texto
                variante="cuerpo"
                tono="secundario"
                accessibilityLiveRegion="polite"
                testID={ID.vacioOfertas}
              >
                {MENSAJE_OFERTAS_VACIAS}
              </Texto>
              <Boton
                etiqueta={ETIQUETA_INTENTAR}
                variante="secundario"
                alPresionar={cargar}
                pista={PISTA_INTENTAR}
                testID={ID.intentar}
              />
            </>
          ) : (
            ofertas.ofertas.map((o) => {
              const e = etiquetaOferta(o);
              return (
                <View key={o.id} style={{ gap: espacio.xs }}>
                  <Boton
                    etiqueta={e.etiqueta}
                    variante={o.periodo === 'mensual' ? 'primario' : 'secundario'}
                    cargando={ocupado === o.id}
                    deshabilitado={ocupado !== null}
                    alPresionar={() => void comprar(o.id)}
                    pista={pistaComprarOferta(o)}
                    testID={ID.oferta(o.periodo)}
                  />
                  <Texto
                    variante="secundario"
                    tono="secundario"
                    testID={ID.ofertaDetalle(o.periodo)}
                    accessibilityLabel={etiquetaAccesibleOfertaDetalle(e.detalle)}
                  >
                    {e.detalle}
                  </Texto>
                </View>
              );
            })
          )}
          {compras?.simulada ? (
            <Texto variante="secundario" tono="secundario" testID={ID.notaSimulada}>
              {NOTA_COMPRA_SIMULADA}
            </Texto>
          ) : null}
        </View>
      ) : null}

      {mensaje ? (
        <Texto
          variante="cuerpo"
          tono={esMensajeErrorPlan(mensaje) ? 'faltante' : undefined}
          accessibilityRole={esMensajeErrorPlan(mensaje) ? 'alert' : 'text'}
          accessibilityLiveRegion="polite"
          accessibilityLabel={etiquetaAccesibleMensajePlan(mensaje)}
          importantForAccessibility="yes"
          testID={ID.mensaje}
        >
          {mensaje}
        </Texto>
      ) : null}

      {compras ? (
        <Boton
          etiqueta={ETIQUETA_RESTAURAR}
          variante="texto"
          ancho="contenido"
          cargando={ocupado === 'restaurar'}
          deshabilitado={ocupado !== null}
          alPresionar={() => void restaurar()}
          pista={PISTA_RESTAURAR}
          testID={ID.restaurar}
        />
      ) : null}
      <Texto variante="secundario" tono="secundario" testID={ID.notaTienda}>
        {NOTA_TIENDA}
      </Texto>
    </Pantalla>
  );
}

/** Ajustes → Plan (`02 §12`): el plan actual y la entrada a la pantalla del plan. */
export function SeccionPlan({ alAbrirPlan }: { alAbrirPlan: () => void }) {
  const resumen = resumenPlan(useVista(obtenerPlan));
  return (
    <Tarjeta testID={ID.ajustesPlan}>
      <Texto variante="subtitulo">{SECCION_AJUSTES}</Texto>
      <Texto
        variante="cuerpo"
        testID={ID.ajustesPlanTitulo}
        accessibilityLabel={etiquetaAccesibleResumenPlan(resumen.titulo, resumen.detalle)}
      >
        {resumen.titulo}
      </Texto>
      {resumen.detalle ? (
        <Texto
          variante="secundario"
          tono="secundario"
          testID={ID.ajustesPlanDetalle}
          importantForAccessibility="no"
        >
          {resumen.detalle}
        </Texto>
      ) : null}
      <Boton
        etiqueta={ETIQUETA_VER_PLANES}
        variante="secundario"
        alPresionar={alAbrirPlan}
        pista={PISTA_VER_PLANES}
        testID={ID.ajustesPlanVer}
      />
    </Tarjeta>
  );
}
