import { UMBRAL_USO_BP } from '@cartera/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  detalleTarjeta,
  etiquetaDiaMes,
  funcionesPlan,
  listarTarjetas,
  type DetalleTarjeta,
  type EstadoCuentaVista,
  type PreguntaLiquidar,
} from '../../servicios';
import { useVista } from '../../sesion/ProveedorSesion';
import {
  Barra,
  Boton,
  Cifra,
  coloresCuenta,
  espacio,
  formatearCentavos,
  Icono,
  orbe,
  Pantalla,
  radio,
  sombra,
  Tarjeta,
  Texto,
  useTema,
} from '../../ui';
import { Fila as FilaLista, Grupo } from '../../ui/componentes/Lista';
import { CandadoPlus } from '../plan/CandadoPlus';
import { EstadoVacio } from '../principal/EstadoVacio';
import { nombreTipoLibro } from '../principal/textos';
import { Dato, FormularioPago, PreguntaLiquidarMeses, Seccion } from './componentes';
import { CorregirSaldo, EditarTarjeta } from './EditarTarjeta';
import { CompromisoMeses, PagosPlaneados, SeccionMeses } from './MesesYPagos';
import {
  ACCESIBILIDAD_TARJETA_NO_ENCONTRADA,
  AYUDA_SALDO_A_FAVOR,
  BTN_CORREGIR_SALDO,
  BTN_EDITAR_TARJETA,
  BTN_LEER_PDF_BANCO,
  BTN_PAGAR,
  BTN_VOLVER,
  etiquetaAccesibleSaldoAFavorDetalle,
  PISTA_PAGAR_TARJETA,
  PISTA_VOLVER,
  CANDADO_COMPROMISO_12_MESES,
  ETIQUETA_DEBES,
  ETIQUETA_DISPONIBLE,
  ETIQUETA_FECHA_LIMITE,
  ETIQUETA_PAGADO_DESDE_CORTE,
  ETIQUETA_PNGI,
  ETIQUETA_PROXIMO_CORTE,
  ETIQUETA_SALDO_A_FAVOR,
  etiquetaAccesibleBarraUsoTarjeta,
  etiquetaAccesibleEstadoCuentaTarjeta,
  etiquetaAccesibleMovimientoTarjeta,
  etiquetaVacioEstadosTarjeta,
  etiquetaVacioMovimientosTarjeta,
  etiquetaSaldoAlCorte,
  NOMBRE_MODO,
  TEXTO_PNGI_CUBIERTO,
  TEXTO_TARJETA_NO_ENCONTRADA,
  textoCicloTarjeta,
  textoDeudaMeses,
  textoFechaLimiteEstado,
  textoPagarPngiAntesDe,
  textoPrimerCorteEnApp,
  textoSinCorteDesdeAlta,
  textoUsoLimiteTarjeta,
  TITULO_CONFIGURACION,
  TITULO_DESDE_ALTA,
  TITULO_DESDE_ULTIMO_CORTE,
  TITULO_ESTADOS_CUENTA,
  TITULO_PAGAR_TARJETA,
  tituloEstadoCuenta,
  VACIO_MOVIMIENTOS_TARJETA,
} from './textos';
import { ESTILO_TITULO_PANTALLA } from '../../ui/componentes/Lista';

type Panel = 'pagar' | 'editar' | 'corregir' | null;

/**
 * Detalle de una tarjeta (`02 §8`): cuánto debes, pago para no generar intereses, fecha límite, próximo corte,
 * uso del límite con el 30 % marcado, saldo a favor (nunca como dinero para gastar), meses sin intereses con su
 * compromiso de 12 meses, compras desde el corte, estados de cuenta, pagos planeados y configuración.
 */
export function PantallaTarjeta({
  tarjetaId,
  alVolver,
  alLeerEstadoPdf,
  pagarAlAbrir = false,
}: {
  tarjetaId: string;
  /** «Pagar» desde Cuentas (B5): abre con el formulario de pago a la vista. */
  pagarAlAbrir?: boolean;
  /** Si no se pasa, la ruta usa la barra nativa (`PLAN-UX` 3.3). */
  alVolver?: () => void;
  /** "Leer el PDF de tu banco" (`02 §26`); sin él no se ofrece. */
  alLeerEstadoPdf?: (() => void) | undefined;
}) {
  // Si la tarjeta deja de existir (p. ej. tras borrar todo), se vuelve.
  const existe = useVista((ctx) => listarTarjetas(ctx).some((t) => t.id === tarjetaId));
  if (!existe) {
    return (
      <Pantalla
        testID="pantalla-tarjeta"
        bordes={['top', 'left', 'right', 'bottom']}
        contenidoStyle={{ gap: espacio.xl }}
      >
        {alVolver ? (
          <Boton
            testID="tarjeta-volver"
            etiqueta={BTN_VOLVER}
            variante="texto"
            ancho="contenido"
            alPresionar={alVolver}
            pista={PISTA_VOLVER}
          />
        ) : null}
        <Texto
          variante="cuerpo"
          tono="secundario"
          testID="tarjeta-no-encontrada"
          accessibilityLabel={ACCESIBILIDAD_TARJETA_NO_ENCONTRADA}
        >
          {TEXTO_TARJETA_NO_ENCONTRADA}
        </Texto>
      </Pantalla>
    );
  }
  return (
    <Detalle
      tarjetaId={tarjetaId}
      {...(alVolver ? { alVolver } : {})}
      alLeerEstadoPdf={alLeerEstadoPdf}
      pagarAlAbrir={pagarAlAbrir}
    />
  );
}

function Detalle({
  tarjetaId,
  alVolver,
  alLeerEstadoPdf,
  pagarAlAbrir,
}: {
  tarjetaId: string;
  alVolver?: () => void;
  alLeerEstadoPdf: (() => void) | undefined;
  pagarAlAbrir: boolean;
}) {
  const d = useVista((ctx) => detalleTarjeta(ctx, tarjetaId));
  const plus = useVista(funcionesPlan);
  const [panel, setPanel] = useState<Panel>(pagarAlAbrir ? 'pagar' : null);
  const [pregunta, setPregunta] = useState<PreguntaLiquidar | null>(null);

  return (
    <Pantalla
      testID="pantalla-tarjeta"
      bordes={['top', 'left', 'right', 'bottom']}
      contenidoStyle={{ gap: espacio.xl }}
    >
      {alVolver ? (
        <Boton
          testID="tarjeta-volver"
          etiqueta={BTN_VOLVER}
          variante="texto"
          ancho="contenido"
          alPresionar={alVolver}
          pista={PISTA_VOLVER}
        />
      ) : null}
      <View style={{ gap: espacio.s }}>
        <Texto
          variante="titulo"
          testID="tarjeta-nombre"
          accessibilityRole="header"
          style={ESTILO_TITULO_PANTALLA}
        >
          {d.nombre}
        </Texto>
        <Texto variante="secundario" tono="secundario" importantForAccessibility="no">
          {NOMBRE_MODO[d.modo]}
        </Texto>
      </View>

      <Resumen d={d} />

      {pregunta && d.saldoAFavor > 0 && d.planes.some((p) => p.estado === 'activo') ? (
        <PreguntaLiquidarMeses
          pregunta={pregunta}
          testID="tarjeta-pregunta-liquidar"
          alTerminar={() => setPregunta(null)}
        />
      ) : null}

      {panel === 'pagar' ? (
        <Tarjeta>
          <Texto variante="subtitulo">{TITULO_PAGAR_TARJETA}</Texto>
          <FormularioPago
            tarjetaId={d.id}
            nombre={d.nombre}
            montoSugerido={d.pngi > 0 ? d.pngi : Math.max(0, d.saldoRevolvente)}
            alTerminar={(r) => {
              setPanel(null);
              setPregunta(r.preguntaLiquidar);
            }}
            alCancelar={() => setPanel(null)}
          />
        </Tarjeta>
      ) : (
        <Boton
          etiqueta={BTN_PAGAR}
          alPresionar={() => setPanel('pagar')}
          testID="tarjeta-pagar"
          pista={PISTA_PAGAR_TARJETA}
        />
      )}

      <SeccionMeses tarjetaId={d.id} planes={d.planes} />
      {/* Plus (`02 §8`): en Gratis los meses siguen en "Meses sin intereses"; solo se oculta el calendario. */}
      {plus.compromisoMsi12Meses ? (
        <CompromisoMeses meses={d.compromiso12Meses} />
      ) : d.compromiso12Meses.some((m) => m.monto > 0) ? (
        <CandadoPlus texto={CANDADO_COMPROMISO_12_MESES} testID="candado-compromiso-12-meses" />
      ) : null}

      {d.modo === 'plan' ? <PagosPlaneados d={d} /> : null}

      <Seccion
        titulo={d.ultimoCorte ? TITULO_DESDE_ULTIMO_CORTE : TITULO_DESDE_ALTA}
        testID="tarjeta-movimientos"
      >
        {d.desdeElCorte.length === 0 ? (
          <EstadoVacio
            icono="tarjeta"
            compacto
            texto={VACIO_MOVIMIENTOS_TARJETA}
            testID="tarjeta-movimientos-vacio"
            etiquetaAccesible={etiquetaVacioMovimientosTarjeta(
              d.ultimoCorte ? TITULO_DESDE_ULTIMO_CORTE : TITULO_DESDE_ALTA,
            )}
          />
        ) : null}
        {d.desdeElCorte.map((m) => {
          const titulo = m.descripcion ?? m.comercio ?? m.categoria ?? nombreTipoLibro(m.tipo);
          const fecha = etiquetaDiaMes(m.fecha);
          const esSalida = m.sentido === 'salida';
          return (
            <View
              key={m.id}
              accessible
              accessibilityLabel={etiquetaAccesibleMovimientoTarjeta(titulo, fecha, m.monto, esSalida)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: espacio.s }}
            >
              <Texto variante="secundario" style={{ flex: 1 }} importantForAccessibility="no">
                {`${titulo} · ${fecha}`}
              </Texto>
              <Cifra
                centavos={esSalida ? -m.monto : m.monto}
                tamano="secundario"
                contexto={titulo}
                importantForAccessibility="no"
              />
            </View>
          );
        })}
      </Seccion>

      <Seccion titulo={TITULO_ESTADOS_CUENTA} testID="tarjeta-estados">
        {d.estadosCuenta.length === 0 ? (
          <EstadoVacio
            icono="documento"
            compacto
            texto={textoPrimerCorteEnApp(d.etiquetaProximoCorte)}
            testID="tarjeta-estados-vacio"
            etiquetaAccesible={etiquetaVacioEstadosTarjeta(textoPrimerCorteEnApp(d.etiquetaProximoCorte))}
          />
        ) : null}
        {d.estadosCuenta.map((e) => (
          <EstadoCuenta key={e.corte} e={e} />
        ))}
        {alLeerEstadoPdf ? (
          <Boton
            etiqueta={BTN_LEER_PDF_BANCO}
            variante="secundario"
            alPresionar={alLeerEstadoPdf}
            testID="tarjeta-leer-pdf"
          />
        ) : null}
      </Seccion>

      <Seccion titulo={TITULO_CONFIGURACION} testID="tarjeta-configuracion">
        {panel === 'editar' ? (
          <EditarTarjeta d={d} alTerminar={() => setPanel(null)} />
        ) : panel === 'corregir' ? (
          <CorregirSaldo d={d} alTerminar={() => setPanel(null)} />
        ) : (
          <Grupo sangria>
            <FilaLista
              testID="tarjeta-editar"
              icono="lapiz"
              familia="salidas"
              titulo={BTN_EDITAR_TARJETA}
              apoyo={textoCicloTarjeta(d.ciclo)}
              testIDApoyo="tarjeta-ciclo-resumen"
              etiquetaAccesible={BTN_EDITAR_TARJETA}
              alPresionar={() => setPanel('editar')}
            />
            <FilaLista
              testID="tarjeta-corregir"
              icono="repetir"
              familia="otros"
              titulo={BTN_CORREGIR_SALDO}
              etiquetaAccesible={BTN_CORREGIR_SALDO}
              alPresionar={() => setPanel('corregir')}
            />
          </Grupo>
        )}
      </Seccion>
      <View style={{ height: espacio.xxxl }} />
    </Pantalla>
  );
}

/**
 * Lo que debes en la tarjeta como una placa violeta (D6: el crédito es violeta), con la cifra grande, las fechas y el
 * anillo de uso como barra menta. Cada dato se sigue oyendo con su etiqueta.
 */
function Resumen({ d }: { d: DetalleTarjeta }) {
  const { esquema } = useTema();
  const p = coloresCuenta[esquema].credito;
  const sec = { color: p.textoSecundario };
  return (
    <View
      testID="tarjeta-resumen"
      style={{
        backgroundColor: p.fondo,
        borderRadius: radio.xl,
        padding: espacio.xl,
        gap: espacio.m,
        overflow: 'hidden',
        ...sombra.tarjeta[esquema],
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          right: -60,
          top: -60,
          width: 200,
          height: 200,
          borderRadius: 100,
          borderWidth: 28,
          borderColor: p.adorno,
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
        <Icono nombre="tarjeta" color={p.textoSecundario} tamano={18} grosor={2} />
        <Texto variante="etiqueta" style={sec}>
          {ETIQUETA_DEBES}
        </Texto>
      </View>
      <Cifra
        centavos={d.deudaTotal}
        tamano="heroe"
        contexto={`Debes en tu ${d.nombre}`}
        testID="tarjeta-deuda"
        style={{ color: p.texto, fontWeight: '300', letterSpacing: -1 }}
      />
      {d.msiPorPagar > 0 ? (
        <Texto variante="secundario" testID="tarjeta-deuda-meses" style={sec}>
          {textoDeudaMeses(formatearCentavos(d.msiPorPagar))}
        </Texto>
      ) : null}
      {d.saldoAFavor > 0 ? (
        <View
          testID="tarjeta-saldo-a-favor"
          accessible
          accessibilityLabel={etiquetaAccesibleSaldoAFavorDetalle(d.saldoAFavor)}
          style={{ gap: espacio.s }}
        >
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Dato
              etiqueta={ETIQUETA_SALDO_A_FAVOR}
              valor={formatearCentavos(d.saldoAFavor)}
              color={p.texto}
              colorEtiqueta={p.textoSecundario}
            />
            <Texto variante="secundario" style={sec}>
              {AYUDA_SALDO_A_FAVOR}
            </Texto>
          </View>
        </View>
      ) : null}
      {d.ultimoCorte ? (
        <View style={{ gap: espacio.xs }}>
          <Dato
            etiqueta={ETIQUETA_PNGI}
            valor={formatearCentavos(d.pngi)}
            testID="tarjeta-pngi"
            color={p.texto}
            colorEtiqueta={p.textoSecundario}
          />
          <Texto variante="secundario" style={sec}>
            {d.pngi > 0 ? textoPagarPngiAntesDe(d.etiquetaFechaLimite) : TEXTO_PNGI_CUBIERTO}
          </Texto>
        </View>
      ) : (
        <Texto variante="secundario" testID="tarjeta-sin-corte" style={sec}>
          {textoSinCorteDesdeAlta(d.etiquetaProximoCorte)}
        </Texto>
      )}
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.textoSecundario, opacity: 0.4 }} />
      <Dato
        etiqueta={ETIQUETA_FECHA_LIMITE}
        valor={d.etiquetaFechaLimite}
        testID="tarjeta-fecha-limite"
        color={p.texto}
        colorEtiqueta={p.textoSecundario}
      />
      <Dato
        etiqueta={ETIQUETA_PROXIMO_CORTE}
        valor={d.etiquetaProximoCorte}
        testID="tarjeta-proximo-corte"
        color={p.texto}
        colorEtiqueta={p.textoSecundario}
      />
      <Dato
        etiqueta={ETIQUETA_DISPONIBLE}
        valor={formatearCentavos(d.disponible)}
        testID="tarjeta-disponible"
        color={p.texto}
        colorEtiqueta={p.textoSecundario}
      />
      <Barra
        llenoBp={d.usoBp}
        marcaBp={UMBRAL_USO_BP}
        etiquetaAccesible={etiquetaAccesibleBarraUsoTarjeta(d.usoPorcentaje, d.limiteCredito)}
        testID="tarjeta-barra-uso"
        alto={10}
        colores={{ riel: p.adorno, lleno: orbe.nucleo, marca: p.texto }}
      />
      <Texto variante="secundario" testID="tarjeta-uso" importantForAccessibility="no" style={sec}>
        {textoUsoLimiteTarjeta(d.usoPorcentaje, formatearCentavos(d.limiteCredito))}
      </Texto>
    </View>
  );
}

function EstadoCuenta({ e }: { e: EstadoCuentaVista }) {
  const fechaCorte = etiquetaDiaMes(e.corte);
  const fechaLimite = etiquetaDiaMes(e.limite);
  return (
    <Tarjeta testID={`estado-${e.corte}`}>
      <View
        accessible
        accessibilityLabel={etiquetaAccesibleEstadoCuentaTarjeta(
          fechaCorte,
          e.saldoCorte,
          e.pagosPosteriores,
          e.pngi,
          fechaLimite,
        )}
      >
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Texto variante="cuerpoFuerte">{tituloEstadoCuenta(fechaCorte)}</Texto>
          <Dato
            etiqueta={etiquetaSaldoAlCorte(e.saldoCorte)}
            valor={formatearCentavos(Math.abs(e.saldoCorte))}
          />
          <Dato etiqueta={ETIQUETA_PAGADO_DESDE_CORTE} valor={formatearCentavos(e.pagosPosteriores)} />
          <Dato etiqueta={ETIQUETA_PNGI} valor={formatearCentavos(e.pngi)} />
          <Texto variante="secundario" tono="secundario">
            {textoFechaLimiteEstado(fechaLimite)}
          </Texto>
        </View>
      </View>
    </Tarjeta>
  );
}
