import { Fragment, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  fijarApartarDeuda,
  listarCuentas,
  listarPersonas,
  listarTarjetas,
  totalesCuentas,
  type CuentaDebes,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import {
  FUENTE,
  Boton,
  Cifra,
  espacio,
  etiquetaHablada,
  Icono,
  Interruptor,
  margenPantalla,
  OBJETIVO_TACTIL_MIN,
  Pantalla,
  Texto,
  useTema,
  type NombreIcono,
} from '../../ui';
import { BTN_COMPARTIDOS_CUENTAS } from '../compartido/textos';
import {
  BTN_VER,
  BTN_VER_PAGOS_FIJOS,
  BTN_VER_PERSONAS,
  etiquetaFila,
  PISTA_CTA_AGREGAR_CUENTA,
  PISTA_VER_PAGOS_FIJOS,
  PISTA_VER_PERSONAS,
} from '../cuentas/textos';
import { BTN_DEDUCCIONES_CUENTAS } from '../deducciones/textos';
import { BTN_TANDAS_CUENTAS } from '../tandas/textos';
import { BTN_SUSCRIPCIONES_CUENTAS } from '../suscripciones/textos';
import { TarjetaCreditoLista } from '../tarjetas/TarjetaCreditoLista';
import { etiquetaAccesibleTarjetaEnLista } from '../tarjetas/textos';
import { CarruselCuentas, type CuentaCarrusel } from './CarruselCuentas';
import { LoQueViene } from './LoQueViene';
import { EstadoVacio } from './EstadoVacio';
import {
  PISTA_COBRAR_DESDE_CUENTAS,
  contextoSaldoLeDebes,
  contextoSaldoTeDebe,
  SUBTITULO_CUENTAS_COMPROMISOS,
  TEXTO_CUENTAS_COMPROMISOS_VACIO,
  TEXTO_CUENTAS_DEBES_VACIO,
  TEXTO_CUENTAS_TIENES_VACIO,
  etiquetaVacioCuentasCompromisos,
  etiquetaVacioCuentasDebes,
  etiquetaVacioCuentasTienes,
  partesTotalesCuentas,
  TITULO_LO_QUE_VIENE,
} from './textos';

/** «••2231» si el nombre no lo trae; si no, el tipo («Débito»), salvo que repita el nombre («Efectivo · Efectivo»). */
function subtituloCuenta(c: { nombre: string; subtipo: string; ultimos4: string | null }): string | null {
  if (c.ultimos4 && !c.nombre.includes(c.ultimos4)) return `••${c.ultimos4}`;
  const nombreTipo = NOMBRE_SUBTIPO[c.subtipo];
  return nombreTipo && nombreTipo.toLowerCase() !== c.nombre.trim().toLowerCase() ? nombreTipo : null;
}

const NOMBRE_SUBTIPO: Record<string, string> = {
  efectivo: 'Efectivo',
  debito: 'Débito',
  billetera: 'Billetera',
  ahorro: 'Ahorro',
};

/**
 * Cuentas (02-UX §11): Tienes · Debes · Te deben · Compromisos (próximos 30 días). Ajustes se abre con el círculo de
 * Tú y «Agregar» (cuenta, tarjeta o pago fijo) vive en el dock de voz (dirección B). Cada tarjeta
 * de crédito abre su detalle (02-UX §8); cada cuenta de Tienes, el suyo (corregir saldo, ver movimientos); cada
 * compromiso, el del pago fijo (cambiar monto, quitar). «Agregar cuenta» y «Agregar pago fijo» cumplen lo que el
 * onboarding promete («agrégalas después en Cuentas»).
 */
export function PantallaCuentas({
  alAbrirTarjeta,
  alPagarTarjeta,
  alAgregarTarjeta,
  alContarEfectivo,
  alAbrirPersona,
  alAbrirTandas,
  alAbrirCompartidos,
  alAbrirSuscripciones,
  alAbrirDeducciones,
  alAgregarCuenta,
  alAbrirCuenta,
  alAbrirPagoFijo,
  alVerPagosFijos,
  alVerPersonas,
  espacioInferior = 0,
}: {
  /** Lo que tapa el dock al pie (dirección B): el contenido deja ese espacio al final. */
  espacioInferior?: number;
  /** Te deben → detalle de la persona con Cobrar (`02 §17`). */
  alAbrirPersona?: (personaId: string) => void;
  alAbrirTarjeta?: (tarjetaId: string) => void;
  /** «Pagar» de la caja del pago para no generar intereses (B5): el detalle con el pago listo. */
  alPagarTarjeta?: (tarjetaId: string) => void;
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
  const { c: tema } = useTema();
  const partes = partesTotalesCuentas(totalesCuentas(v));
  const tarjetasDebes = v.debes.filter((d) => d.tipo === 'tarjeta');
  const personasDebes = v.debes.filter((d) => d.tipo === 'persona');
  // D6: el carrusel lleva tus cuentas y tus tarjetas de crédito (lo que debes en cada una).
  const carrusel: CuentaCarrusel[] = [
    ...v.tienes.map((c) => ({ tipo: 'tienes' as const, c, subtitulo: subtituloCuenta(c) })),
    ...tarjetasDebes.map((d) => {
      const t = tarjetas.find((x) => x.id === d.id) ?? null;
      return {
        tipo: 'credito' as const,
        d,
        usoPorcentaje: t ? t.usoPorcentaje : null,
        etiqueta: etiquetaAccesibleTarjetaEnLista(d, t),
      };
    }),
  ];
  return (
    <Pantalla
      testID="pantalla-cuentas"
      // Arriba manda la navegación de la dirección B (ya cubre la barra de estado); abajo, el dock.
      bordes={['left', 'right']}
      contenidoStyle={{ gap: 14, paddingTop: espacio.m, paddingBottom: margenPantalla + espacioInferior }}
    >
      {/* B5: lo que tienes y lo que debes, en una frase. */}
      <Text
        testID="cuentas-titulo"
        accessibilityRole="header"
        accessibilityLabel={etiquetaHablada(partes.join(''))}
        style={{
          fontFamily: FUENTE,
          fontSize: 24,
          lineHeight: 32,
          fontWeight: '600',
          color: tema.texto,
          paddingHorizontal: espacio.s,
          paddingBottom: espacio.xs,
        }}
      >
        {partes.map((parte, i) =>
          i % 2 === 1 ? (
            <Text key={i} style={{ fontFamily: FUENTE, fontWeight: '800' }}>
              {parte}
            </Text>
          ) : (
            <Fragment key={i}>{parte}</Fragment>
          ),
        )}
      </Text>

      {/* D6: tus cuentas como tarjetas (efectivo menta, débito azul, crédito violeta) en un carrusel. */}
      {carrusel.length > 0 ? (
        <View testID="seccion-tienes">
          <CarruselCuentas
            cuentas={carrusel}
            {...(alContarEfectivo ? { alContarEfectivo } : {})}
            {...(alAbrirCuenta ? { alAbrirCuenta } : {})}
            {...(alAbrirTarjeta ? { alAbrirTarjeta } : {})}
          />
        </View>
      ) : null}
      {v.tienes.length === 0 ? (
        <Seccion titulo="Tienes" testID={carrusel.length > 0 ? 'seccion-tienes-vacia' : 'seccion-tienes'}>
          <EstadoVacio
            texto={TEXTO_CUENTAS_TIENES_VACIO}
            testID="cuentas-tienes-vacio"
            etiquetaAccesible={etiquetaVacioCuentasTienes()}
            {...(alAgregarCuenta ? { pistaCta: PISTA_CTA_AGREGAR_CUENTA } : {})}
          />
        </Seccion>
      ) : null}

      {/* D6: cada tarjeta de crédito con su anillo de uso y, si toca, el pago para no generar intereses. */}
      {tarjetasDebes.map((d) => (
        <TarjetaCreditoLista
          key={d.id}
          d={d}
          t={tarjetas.find((t) => t.id === d.id) ?? null}
          {...(alAbrirTarjeta ? { alAbrir: () => alAbrirTarjeta(d.id) } : {})}
          {...(alPagarTarjeta ? { alPagar: () => alPagarTarjeta(d.id) } : {})}
        />
      ))}

      {personasDebes.length > 0 || v.debes.length === 0 ? (
        <Seccion titulo="Debes" testID="seccion-debes">
          {v.debes.length === 0 ? (
            <EstadoVacio
              texto={TEXTO_CUENTAS_DEBES_VACIO}
              testID="cuentas-debes-vacio"
              etiquetaAccesible={etiquetaVacioCuentasDebes()}
              {...(alAgregarTarjeta ? { pistaCta: PISTA_CTA_AGREGAR_CUENTA } : {})}
            />
          ) : (
            <View accessibilityRole="list" testID="seccion-debes-lista">
              {personasDebes.map((d, i) => (
                <View key={d.id} role="listitem">
                  {i > 0 ? <Separador /> : null}
                  <PersonaDebes d={d} {...(alAbrirPersona ? { alAbrirPersona } : {})} />
                </View>
              ))}
            </View>
          )}
        </Seccion>
      ) : null}

      {v.teDeben.length > 0 ? (
        <Seccion titulo="Te deben" testID="seccion-te-deben">
          <View accessibilityRole="list" testID="seccion-te-deben-lista">
            {v.teDeben.map((p, i) => (
              <Fila
                key={p.id}
                primera={i === 0}
                icono="personas"
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
        titulo={TITULO_LO_QUE_VIENE}
        tituloAccesible={`${TITULO_LO_QUE_VIENE}, ${SUBTITULO_CUENTAS_COMPROMISOS.toLowerCase()}`}
        testID="seccion-compromisos"
      >
        {v.loQueViene.length === 0 ? (
          <EstadoVacio
            texto={TEXTO_CUENTAS_COMPROMISOS_VACIO}
            testID="cuentas-compromisos-vacio"
            etiquetaAccesible={etiquetaVacioCuentasCompromisos()}
          />
        ) : (
          // D6: los pagos fijos y los ingresos que vienen, como línea de tiempo.
          <LoQueViene items={v.loQueViene} {...(alAbrirPagoFijo ? { alAbrirPagoFijo } : {})} />
        )}
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
  const { c } = useTema();
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: c.superficie,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: c.borde,
        paddingHorizontal: espacio.l,
        paddingTop: espacio.xs,
        paddingBottom: espacio.s,
        gap: espacio.xs,
      }}
    >
      <Texto
        variante="etiqueta"
        tono="secundario"
        testID={`${testID}-titulo`}
        accessibilityRole="header"
        {...(tituloAccesible ? { accessibilityLabel: tituloAccesible } : {})}
        style={{
          fontSize: 15,
          lineHeight: 20,
          fontWeight: '700',
          paddingTop: espacio.s,
          paddingBottom: espacio.xs,
        }}
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
  icono,
  primera = false,
  compacta = false,
}: {
  titulo: string;
  subtitulo: string | null;
  centavos: number;
  contextoSaldo: string;
  testID?: string;
  accion?: { etiqueta: string; etiquetaAccesible?: string; pista?: string; alPresionar: () => void };
  abrir?: { pista: string; alPresionar: () => void; etiquetaVer?: string };
  /** Cuadro con el ícono a la izquierda (Tienes, Te deben); sin él, la fila compacta de «Lo que viene». */
  icono?: NombreIcono;
  /** La primera de su lista no lleva separador arriba. */
  primera?: boolean;
  /** «Internet · mié 28» en un renglón de 50 (B5). */
  compacta?: boolean;
}) {
  const { c } = useTema();
  const contenido = (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: espacio.m,
        minHeight: compacta ? 50 : 62,
      }}
    >
      {icono ? (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: c.iconoFondo,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icono nombre={icono} color={c.acento} />
        </View>
      ) : null}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={compacta ? { flex: 1, flexDirection: 'row', flexWrap: 'wrap' } : { flex: 1, gap: 1 }}
      >
        <Texto variante="cuerpoFuerte" style={{ lineHeight: 22, fontWeight: compacta ? '600' : '700' }}>
          {titulo}
        </Texto>
        {subtitulo && compacta ? (
          <>
            <Texto variante="cuerpoFuerte" style={{ lineHeight: 22, fontWeight: '600' }}>
              {' · '}
            </Texto>
            <Texto variante="cuerpoFuerte" style={{ lineHeight: 22, fontWeight: '600' }}>
              {subtitulo}
            </Texto>
          </>
        ) : subtitulo ? (
          <Texto variante="secundario" tono="secundario" style={{ lineHeight: 20 }}>
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
        {primera ? null : <Separador sangria={icono ? 52 : 0} />}
        <Pressable
          onPress={abrir.alPresionar}
          accessibilityRole="button"
          accessibilityLabel={etiquetaFila({ titulo, subtitulo, contexto: contextoSaldo, centavos })}
          accessibilityHint={abrir.pista}
          {...(testID ? { testID: `${testID}-abrir` } : {})}
          style={({ pressed }) => ({ minHeight: OBJETIVO_TACTIL_MIN, opacity: pressed ? 0.7 : 1 })}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {contenido}
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View role="listitem" {...(testID ? { testID } : {})}>
      {primera ? null : <Separador sangria={icono ? 52 : 0} />}
      {contenido}
      {abrir ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, marginLeft: icono ? 44 : 0 }}>
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
      ) : botonAccion ? (
        <View style={{ flexDirection: 'row', marginLeft: icono ? 44 : 0 }}>{botonAccion}</View>
      ) : null}
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
    <View testID={`cuenta-${d.id}`} style={{ gap: espacio.s, paddingVertical: espacio.s }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flex: 1, gap: espacio.xs }}
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
    </View>
  );
}

/** Línea entre renglones de una tarjeta de Cuentas (B5), con sangría bajo el ícono. */
function Separador({ sangria = 52 }: { sangria?: number }) {
  const { c } = useTema();
  return <View style={{ height: 1, backgroundColor: c.superficieAlterna, marginLeft: sangria }} />;
}
