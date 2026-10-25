import { useEffect, useState } from 'react';
import { useCompartido } from '../../compartido/ProveedorCompartido';
import {
  crearGrupoCompartido,
  listarGruposCompartidos,
  MENSAJE_SERVIDOR,
  mensajeError,
  mensajeErrorCompartido,
  sincronizarGruposAbiertos,
  unirseConQr,
} from '../../servicios';
import { useSesion, useVista } from '../../sesion/ProveedorSesion';
import { Boton, CampoTexto, espacio, EstadoVacio, etiquetaHablada, Pantalla, Tarjeta, Texto } from '../../ui';
import { useAnunciarEnIos } from '../avisos/anunciar';
import { MensajeError } from '../onboarding/componentes';
import { CodigoQr } from './CodigoQr';
import { EscanerQr } from './EscanerQr';
import {
  AVISO_REVINCULAR_LISTA,
  AYUDA_NOMBRE_PAREJA,
  BTN_CANCELAR,
  BTN_CREAR_CODIGO,
  BTN_CREAR_CON_ALGUIEN,
  BTN_ESCANEAR_CODIGO,
  BTN_ESCANEAR_SU_CODIGO,
  BTN_LISTO,
  ERROR_NOMBRE_PAREJA,
  ETIQUETA_NOMBRE_PAREJA,
  ETIQUETA_VOLVER,
  instruccionQrTrasCrear,
  PISTA_ABRIR_ESCANER,
  PISTA_CREAR_CODIGO,
  PISTA_CREAR_CON_ALGUIEN,
  PISTA_ESCANEAR_CODIGO,
  PISTA_ESCRIBIR_NOMBRE_PAREJA,
  PISTA_ABRIR_GRUPO,
  PISTA_CANCELAR_CREAR,
  PISTA_CANCELAR_UNIRSE,
  PISTA_LISTO_TRAS_QR,
  PISTA_VOLVER_CUENTAS,
  etiquetaVacioCompartidos,
  TEXTO_COMPARTIDOS_VACIO,
  TITULO_GASTOS_COMPARTIDOS,
} from './textos';

type Modo =
  | { tipo: 'lista' }
  | { tipo: 'crear' }
  | { tipo: 'qr'; grupoId: string; qr: string; nombre: string }
  | { tipo: 'unirse'; escaneando: boolean };

/**
 * Cuentas → Gastos compartidos (`02 §27`): tus grupos con su saldo, "Crear con alguien" (muestra el QR) y
 * "Escanear código" (te une al grupo de tu pareja). Al abrir sincroniza los grupos abiertos.
 */
export function PantallaCompartidos({
  alVolver,
  alAbrirGrupo,
}: {
  /** Si no se pasa, la ruta usa la barra nativa (`PLAN-UX` 3.3). */
  alVolver?: () => void;
  alAbrirGrupo: (grupoId: string) => void;
}) {
  const { ctx, refrescar } = useSesion();
  const deps = useCompartido();
  const grupos = useVista((c) => listarGruposCompartidos(c, deps.almacen));
  const [modo, setModo] = useState<Modo>({ tipo: 'lista' });
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Sin cliente de nube (build sin Supabase) crear y unirse fallarían después de pedir nombre o cámara: se dice
  // desde el principio y no se ofrecen.
  const sinServicio = deps.cliente === null;
  useAnunciarEnIos(error);

  useEffect(() => {
    let vivo = true;
    void sincronizarGruposAbiertos(ctx, deps).then(() => {
      if (vivo) refrescar();
    });
    return () => {
      vivo = false;
    };
  }, [ctx, deps, refrescar]);

  const volverALista = () => {
    setModo({ tipo: 'lista' });
    setNombre('');
    setError(null);
  };

  /** Al abrir un grupo la lista queda limpia: si regresas, ves tus grupos y no el paso anterior. */
  const abrirGrupo = (grupoId: string) => {
    volverALista();
    alAbrirGrupo(grupoId);
  };

  const crear = async () => {
    if (nombre.trim() === '') {
      setError(ERROR_NOMBRE_PAREJA);
      return;
    }
    setOcupado(true);
    try {
      const r = await crearGrupoCompartido(ctx, deps, nombre);
      if (!r.ok) setError(mensajeErrorCompartido(r.error));
      else {
        setError(null);
        setModo({ tipo: 'qr', grupoId: r.grupoId, qr: r.qr, nombre: nombre.trim() });
        refrescar();
      }
    } catch (e) {
      setError(mensajeError(e, MENSAJE_SERVIDOR));
    } finally {
      setOcupado(false);
    }
  };

  const unirse = async (texto: string) => {
    setOcupado(true);
    try {
      const r = await unirseConQr(ctx, deps, texto, nombre);
      refrescar();
      if (r.ok) abrirGrupo(r.grupoId);
      else {
        setError(mensajeErrorCompartido(r.error));
        setModo({ tipo: 'unirse', escaneando: false });
      }
    } catch (e) {
      setError(mensajeError(e, MENSAJE_SERVIDOR));
      setModo({ tipo: 'unirse', escaneando: false });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Pantalla
      testID="pantalla-compartidos"
      bordes={['top', 'left', 'right', 'bottom']}
      contenidoStyle={{ gap: espacio.xl }}
    >
      {/* Barra nativa si no hay alVolver; si no, «Volver» en contenido (pruebas). */}
      {alVolver ? (
        <Boton
          testID="compartidos-volver"
          etiqueta={ETIQUETA_VOLVER}
          variante="texto"
          ancho="contenido"
          pista={PISTA_VOLVER_CUENTAS}
          alPresionar={alVolver}
        />
      ) : null}
      <Texto variante="titulo" testID="compartidos-titulo" accessibilityRole="header">
        {TITULO_GASTOS_COMPARTIDOS}
      </Texto>

      {modo.tipo === 'lista' ? (
        <>
          {sinServicio ? (
            <Texto
              variante="cuerpo"
              testID="compartidos-sin-servicio"
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              {mensajeErrorCompartido('sin_servicio')}
            </Texto>
          ) : grupos.length === 0 ? (
            <EstadoVacio
              texto={TEXTO_COMPARTIDOS_VACIO}
              testID="compartidos-vacio"
              etiquetaAccesible={etiquetaVacioCompartidos()}
            />
          ) : null}
          {grupos.map((g) => (
            <Tarjeta
              key={g.id}
              testID={`compartido-${g.id}`}
              alPresionar={() => abrirGrupo(g.id)}
              etiquetaAccesible={etiquetaHablada(`${g.nombre}. ${g.avisoCierre ?? g.saldo.texto}`)}
              pista={PISTA_ABRIR_GRUPO}
            >
              <Texto variante="cuerpoFuerte">{g.nombre}</Texto>
              <Texto variante="secundario" accessibilityLabel={etiquetaHablada(g.saldo.texto)}>
                {g.saldo.texto}
              </Texto>
              {g.avisoCierre ? (
                <Texto variante="secundario" tono="secundario">
                  {g.avisoCierre}
                </Texto>
              ) : null}
              {g.revincular ? (
                <Texto variante="secundario" tono="faltante">
                  {AVISO_REVINCULAR_LISTA}
                </Texto>
              ) : null}
            </Tarjeta>
          ))}
          {sinServicio ? null : (
            <>
              <Boton
                testID="compartidos-crear"
                etiqueta={BTN_CREAR_CON_ALGUIEN}
                pista={PISTA_CREAR_CON_ALGUIEN}
                alPresionar={() => setModo({ tipo: 'crear' })}
              />
              <Boton
                testID="compartidos-escanear"
                etiqueta={BTN_ESCANEAR_CODIGO}
                variante="secundario"
                pista={PISTA_ESCANEAR_CODIGO}
                alPresionar={() => setModo({ tipo: 'unirse', escaneando: false })}
              />
            </>
          )}
        </>
      ) : null}

      {modo.tipo === 'crear' ? (
        <>
          <CampoTexto
            testID="compartidos-nombre"
            etiqueta={ETIQUETA_NOMBRE_PAREJA}
            valor={nombre}
            alCambiar={setNombre}
            ayuda={AYUDA_NOMBRE_PAREJA}
          />
          <MensajeError texto={error} />
          <Boton
            testID="compartidos-crear-codigo"
            etiqueta={BTN_CREAR_CODIGO}
            pista={PISTA_CREAR_CODIGO}
            cargando={ocupado}
            alPresionar={() => void crear()}
          />
          <Boton
            testID="compartidos-cancelar"
            etiqueta={BTN_CANCELAR}
            variante="texto"
            pista={PISTA_CANCELAR_CREAR}
            alPresionar={volverALista}
          />
        </>
      ) : null}

      {modo.tipo === 'qr' ? (
        <>
          <Texto variante="cuerpo" testID="compartidos-instruccion-qr" importantForAccessibility="yes">
            {instruccionQrTrasCrear(modo.nombre)}
          </Texto>
          <CodigoQr texto={modo.qr} testID="compartidos-qr" />
          <Boton
            testID="compartidos-listo"
            etiqueta={BTN_LISTO}
            pista={PISTA_LISTO_TRAS_QR}
            alPresionar={() => abrirGrupo(modo.grupoId)}
          />
        </>
      ) : null}

      {modo.tipo === 'unirse' ? (
        modo.escaneando ? (
          <EscanerQr alLeer={(t) => void unirse(t)} alCancelar={volverALista} />
        ) : (
          <>
            <CampoTexto
              testID="compartidos-nombre"
              etiqueta={ETIQUETA_NOMBRE_PAREJA}
              valor={nombre}
              alCambiar={setNombre}
              ayuda={AYUDA_NOMBRE_PAREJA}
            />
            <MensajeError texto={error} />
            <Boton
              testID="compartidos-abrir-escaner"
              etiqueta={BTN_ESCANEAR_SU_CODIGO}
              pista={nombre.trim() !== '' ? PISTA_ABRIR_ESCANER : PISTA_ESCRIBIR_NOMBRE_PAREJA}
              cargando={ocupado}
              alPresionar={() => {
                if (nombre.trim() === '') setError(ERROR_NOMBRE_PAREJA);
                else {
                  setError(null);
                  setModo({ tipo: 'unirse', escaneando: true });
                }
              }}
            />
            <Boton
              testID="compartidos-cancelar"
              etiqueta={BTN_CANCELAR}
              variante="texto"
              pista={PISTA_CANCELAR_UNIRSE}
              alPresionar={volverALista}
            />
          </>
        )
      ) : null}
    </Pantalla>
  );
}
