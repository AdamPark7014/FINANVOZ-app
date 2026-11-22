import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { obtenerPlan, sincronizarPlan, type EstadoTienda } from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { usePlanTienda } from '../../suscripciones/ProveedorPlan';
import type { OfertaPlus } from '../../suscripciones/tipos';
import {
  Boton,
  espacio,
  heroeDia,
  Icono,
  OBJETIVO_TACTIL_MIN,
  orbe,
  Pantalla,
  radio,
  Tarjeta,
  Texto,
  useTema,
} from '../../ui';
import { TituloPantalla } from '../../ui/componentes/Lista';
import {
  CARGANDO_OFERTAS,
  CUERPO_PLAN_IOS,
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
  NOTA_PLUS_DE_PRUEBA,
  NOTA_TIENDA,
  resumenPlan,
  SECCION_AJUSTES,
  SECCION_INCLUYE,
  SECCION_INCLUYE_PRUEBA,
  TITULO_PANTALLA,
  TITULO_PLAN_IOS,
  FUNCIONES_PLUS,
} from './textos';

type Ofertas = { tipo: 'cargando' } | { tipo: 'listas'; ofertas: readonly OfertaPlus[] } | { tipo: 'error' };

/**
 * Plan (RF-PAG-01, `01 §11`, `02 §12`): qué incluye Plus, la prueba de 14 días y los precios que da Google Play.
 * Comprar y restaurar pasan por el adaptador de compras; el plan se guarda con `sincronizarPlan` y todas las
 * vistas se refrescan. En Gratis nada se bloquea: aquí solo se ofrece el análisis de Plus. En una build de prueba
 * sin tienda («Plus de prueba») solo dice que es una prueba sin cobro y lo que incluye.
 */
export function PantallaPlan({ alVolver }: { alVolver?: () => void }) {
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

  // «Plus de prueba» (build de prueba sin tienda, en iPhone o Android): todo Plus, sin cobro, sin fecha, sin
  // ofertas ni "Restaurar", y sin nombrar tiendas ni precios.
  if (vista.plusDePrueba) {
    return (
      <Pantalla
        testID={ID.pantalla}
        bordes={['top', 'left', 'right', 'bottom']}
        contenidoStyle={{ gap: espacio.xl }}
      >
        {alVolver ? (
          <Boton
            etiqueta={ETIQUETA_VOLVER}
            variante="texto"
            ancho="contenido"
            alPresionar={alVolver}
            pista={PISTA_VOLVER}
            testID={ID.volver}
          />
        ) : null}
        <TituloPantalla testID={ID.tituloPantalla} titulo={TITULO_PANTALLA} />
        <PlacaPlan testID={ID.plusDePrueba} titulo={resumen.titulo} detalle={resumen.detalle} />
        <Tarjeta testID={ID.incluye}>
          <Texto variante="subtitulo">{SECCION_INCLUYE_PRUEBA}</Texto>
          <ListaBeneficios items={FUNCIONES_PLUS} />
        </Tarjeta>
        <Texto variante="secundario" tono="secundario" testID={ID.notaPlusDePrueba}>
          {NOTA_PLUS_DE_PRUEBA}
        </Texto>
      </Pantalla>
    );
  }

  // iPhone: sin compras ni tienda en esta versión (M14). Solo se explica, sin nombrar tiendas ni precios ni
  // ofrecer compras, aunque una build de desarrollo traiga la tienda simulada.
  if (Platform.OS === 'ios') {
    return (
      <Pantalla
        testID={ID.pantalla}
        bordes={['top', 'left', 'right', 'bottom']}
        contenidoStyle={{ gap: espacio.xl }}
      >
        {alVolver ? (
          <Boton
            etiqueta={ETIQUETA_VOLVER}
            variante="texto"
            ancho="contenido"
            alPresionar={alVolver}
            pista={PISTA_VOLVER}
            testID={ID.volver}
          />
        ) : null}
        <TituloPantalla testID={ID.tituloPantalla} titulo={TITULO_PANTALLA} />
        <Tarjeta testID={ID.soloIos}>
          <Texto variante="subtitulo">{TITULO_PLAN_IOS}</Texto>
          <Texto variante="cuerpo" tono="secundario">
            {CUERPO_PLAN_IOS}
          </Texto>
        </Tarjeta>
        <Tarjeta testID={ID.incluye}>
          <Texto variante="subtitulo">{SECCION_INCLUYE}</Texto>
          <ListaBeneficios items={INCLUYE_PLUS} />
        </Tarjeta>
      </Pantalla>
    );
  }

  return (
    <Pantalla
      testID={ID.pantalla}
      bordes={['top', 'left', 'right', 'bottom']}
      contenidoStyle={{ gap: espacio.xl }}
    >
      {alVolver ? (
        <Boton
          etiqueta={ETIQUETA_VOLVER}
          variante="texto"
          ancho="contenido"
          alPresionar={alVolver}
          pista={PISTA_VOLVER}
          testID={ID.volver}
        />
      ) : null}
      <TituloPantalla testID={ID.tituloPantalla} titulo={TITULO_PANTALLA} />

      <PlacaPlan testID={ID.actual} titulo={resumen.titulo} detalle={resumen.detalle}>
        {vista.plan === 'plus' && compras ? (
          <Boton
            etiqueta={ETIQUETA_ADMINISTRAR}
            variante="secundario"
            alPresionar={() => void compras.administrar().catch(() => undefined)}
            pista={PISTA_ADMINISTRAR}
            testID={ID.administrar}
          />
        ) : null}
      </PlacaPlan>

      <Tarjeta testID={ID.incluye}>
        <Texto variante="subtitulo">{SECCION_INCLUYE}</Texto>
        <ListaBeneficios items={INCLUYE_PLUS} />
        <Texto variante="secundario" tono="secundario" accessibilityLabel={etiquetaAccesibleIncluyeGratis()}>
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
        <>
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
          {/* Cobro y cancelación solo cuando hay tienda: sin ella no se puede contratar nada. */}
          <Texto variante="secundario" tono="secundario" testID={ID.notaTienda}>
            {NOTA_TIENDA}
          </Texto>
        </>
      ) : null}
    </Pantalla>
  );
}

/** La placa del plan actual: pino profundo con el destello de Plus, como la placa de Inicio. */
function PlacaPlan({
  testID,
  titulo,
  detalle,
  children,
}: {
  testID: string;
  titulo: string;
  detalle: string | null | undefined;
  children?: ReactNode;
}) {
  const { esquema } = useTema();
  const placa = heroeDia[esquema];
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: placa.fondo,
        borderRadius: radio.xl,
        padding: espacio.xl,
        gap: espacio.m,
        overflow: 'hidden',
      }}
    >
      <Halo />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
        <Icono nombre="destello" color={orbe.nucleo} tamano={18} grosor={2} />
        <Texto variante="etiqueta" style={{ color: placa.textoSecundario }}>
          {SECCION_AJUSTES}
        </Texto>
      </View>
      <Texto
        variante="subtitulo"
        testID={ID.titulo}
        accessibilityLabel={etiquetaAccesibleResumenPlan(titulo, detalle ?? null)}
        style={{ color: placa.texto, fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.3 }}
      >
        {titulo}
      </Texto>
      {detalle ? (
        <Texto
          variante="cuerpo"
          testID={ID.detalle}
          importantForAccessibility="no"
          style={{ color: placa.textoSecundario }}
        >
          {detalle}
        </Texto>
      ) : null}
      {children}
    </View>
  );
}

/** Círculo menta muy tenue en la esquina de las placas pino (decorativo). */
function Halo() {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        right: -40,
        top: -40,
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: orbe.nucleo,
        opacity: 0.12,
      }}
    />
  );
}

/** Lo que incluye Plus: cada beneficio con su palomita menta (la lista se oye como lista). */
function ListaBeneficios({ items }: { items: readonly string[] }) {
  const { c } = useTema();
  return (
    <View accessibilityRole="list" style={{ gap: espacio.m }}>
      {items.map((t) => (
        <View
          key={t}
          role="listitem"
          accessible
          accessibilityLabel={etiquetaAccesibleBeneficioPlus(t)}
          style={{ flexDirection: 'row', gap: espacio.m, alignItems: 'flex-start' }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              marginTop: 1,
              backgroundColor: c.iconoFondo,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icono nombre="palomita" color={c.acentoTexto} tamano={14} grosor={2.6} />
          </View>
          <Texto variante="cuerpo" style={{ flex: 1 }}>
            {t}
          </Texto>
        </View>
      ))}
    </View>
  );
}

/**
 * Ajustes → Plan (`02 §12`): el plan actual y la entrada a la pantalla del plan. En Tú es la placa de arriba (pase de
 * pulido, 22-11): pino profundo como la placa de Inicio, con el destello de Plus y el botón menta.
 */
export function SeccionPlan({ alAbrirPlan }: { alAbrirPlan: () => void }) {
  const resumen = resumenPlan(useVista(obtenerPlan));
  const { esquema } = useTema();
  const placa = heroeDia[esquema];
  return (
    <View
      testID={ID.ajustesPlan}
      style={{
        backgroundColor: placa.fondo,
        borderRadius: radio.xl,
        padding: espacio.xl,
        gap: espacio.m,
        overflow: 'hidden',
      }}
    >
      <Halo />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
        <Icono nombre="destello" color={orbe.nucleo} tamano={18} grosor={2} />
        <Texto variante="etiqueta" style={{ color: placa.textoSecundario }}>
          {SECCION_AJUSTES}
        </Texto>
      </View>
      <View style={{ gap: espacio.xs }}>
        <Texto
          variante="subtitulo"
          testID={ID.ajustesPlanTitulo}
          accessibilityLabel={etiquetaAccesibleResumenPlan(resumen.titulo, resumen.detalle)}
          style={{ color: placa.texto, fontSize: 22, lineHeight: 28, fontWeight: '700' }}
        >
          {resumen.titulo}
        </Texto>
        {resumen.detalle ? (
          <Texto
            variante="secundario"
            testID={ID.ajustesPlanDetalle}
            importantForAccessibility="no"
            style={{ color: placa.textoSecundario }}
          >
            {resumen.detalle}
          </Texto>
        ) : null}
      </View>
      <Pressable
        testID={ID.ajustesPlanVer}
        onPress={alAbrirPlan}
        accessibilityRole="button"
        accessibilityLabel={ETIQUETA_VER_PLANES}
        accessibilityHint={PISTA_VER_PLANES}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          minHeight: OBJETIVO_TACTIL_MIN,
          paddingHorizontal: espacio.xl,
          borderRadius: radio.pastilla,
          backgroundColor: orbe.nucleo,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pressed ? 0.97 : 1 }],
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Texto variante="etiqueta" style={{ color: '#0B2A23', fontSize: 15 }}>
          {ETIQUETA_VER_PLANES}
        </Texto>
      </Pressable>
    </View>
  );
}
