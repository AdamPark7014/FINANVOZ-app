import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dockVoz, espacio, margenPantalla, useTema } from '../../ui';
import { useReservarEspacioAviso } from '../../ui/componentes/Aviso';
import { InvitacionAvisos } from '../avisos/InvitacionAvisos';
import { useMedidasDock } from '../navegacion/DockVoz';
import { EnlaceAnaliticaCorreccion } from '../principal/ConfirmacionRegistro';
import { AvisosUnaVez } from './AvisosUnaVez';
import { BarraVoz } from './BarraVoz';
import { Conversacion, useTurnosNuevos, type ModoConversacion } from './Conversacion';
import { PanelDesglose } from './PanelDesglose';
import { PildoraDia } from './PildoraDia';
import { Reposo } from './Reposo';
import { useAsistente, type Asistente, type OpcionesAsistente } from './useAsistente';

/**
 * El asistente (dirección B «Plática», tableros B1–B3; testID `pantalla-hoy` para Maestro). Mientras no hay turnos de
 * esta sesión está en reposo (B1): el saludo, la cifra grande, lo pendiente y «Puedes decirme». Con conversación
 * (B2), una píldora arriba con la cifra del día y la conversación debajo. Abajo, siempre, el dock de voz. El teclado
 * empuja todo; el dock queda sobre él.
 */
export function PantallaAsistente(props: OpcionesAsistente) {
  const a = useAsistente(props);
  const { c } = useTema();
  return (
    <SafeAreaView
      {...a.cortarAlTocar}
      testID="pantalla-hoy"
      // Arriba manda la navegación (`NavegacionSuperior`, que ya cubre la barra de estado); abajo, el dock.
      edges={['left', 'right']}
      style={{ flex: 1, backgroundColor: c.fondo }}
    >
      <EnlaceAnaliticaCorreccion />
      <Contenedor>
        <Cuerpo a={a} props={props} />
      </Contenedor>
    </SafeAreaView>
  );
}

/**
 * La conversación con su dock, sin reposo ni píldora: la usa la envoltura `PanelRegistrar` que conservan las
 * pantallas que dictan dentro de otra (pruebas de compartido, micrófonos).
 */
export function PanelConversacion(props: OpcionesAsistente) {
  const a = useAsistente({ ...props, soloSesion: true });
  return (
    <View style={{ gap: espacio.m }} testID="panel-registrar">
      <EnlaceAnaliticaCorreccion />
      <Cuerpo a={a} props={props} enPanel />
    </View>
  );
}

function Contenedor({ children }: { children: ReactNode }) {
  // El teclado se dibuja encima en los dos sistemas: en Android la app va de borde a borde y `adjustResize` ya no
  // encoge la ventana (las capturas de CI del 25-10 mostraban «¿Qué registro?» bajo el teclado). El contenedor se
  // encoge y el dock queda pegado al teclado.
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      {children}
    </KeyboardAvoidingView>
  );
}

function Cuerpo({
  a,
  props,
  enPanel = false,
}: {
  a: Asistente;
  props: OpcionesAsistente;
  enPanel?: boolean;
}) {
  const nav = props.navegacion;
  const { abajo } = useMedidasDock();
  // El dock de voz va fijo al pie: el aviso inferior sube para no taparlo.
  const [altoPie, setAltoPie] = useState(0);
  useReservarEspacioAviso(altoPie);
  // Reposo (B1) mientras no hay turnos de esta sesión; en panel (dentro de otra pantalla) siempre conversación.
  const enReposo = !enPanel && a.idsSesion.size === 0;
  // Cada turno nuevo del asistente se anuncia (también los que llegan mientras se ve el reposo).
  const esNuevo = useTurnosNuevos(a.turnos);
  const encabezado = enPanel ? null : (
    <View style={{ gap: espacio.m }}>
      <AvisosUnaVez avisos={a.vista.avisos} />
      <InvitacionAvisos />
    </View>
  );
  const alAbrirArqueo = nav.alAbrirArqueo;
  const desglose =
    a.verDesglose && a.vista.estado !== 'sin_ingreso' ? (
      <PanelDesglose
        vista={a.vista}
        probabilidad={a.plus.probabilidad}
        conCandado={!a.plus.probabilidad && a.conTienda}
        {...(props.bloques ? { bloques: props.bloques } : {})}
        {...(nav.alAbrirMeAlcanza && (a.plus.meAlcanza || a.conTienda)
          ? { alMeAlcanza: () => nav.alAbrirMeAlcanza?.() }
          : {})}
      />
    ) : null;
  const conversacion = (modo: ModoConversacion, virtualizada: boolean) => (
    <Conversacion
      virtualizada={virtualizada}
      modo={modo}
      esNuevo={esNuevo}
      alEscribir={() => a.setEscribiendo(true)}
      turnos={a.turnos}
      idsSesion={a.idsSesion}
      tarjetasAccion={a.vista.tarjetasAccion}
      observaciones={a.observaciones}
      alVerMovimientosFiltro={(filtro) => nav.alVerMovimientos(filtro)}
      encabezado={enReposo ? null : encabezado}
      alVerMovimientos={() => nav.alVerMovimientos()}
      {...(alAbrirArqueo ? { alAbrirArqueo: () => alAbrirArqueo() } : {})}
      alResultadoTarjeta={a.alResultadoTarjeta}
      alListoTarjeta={a.alListoTarjeta}
      alCancelarTarjeta={a.resolver}
    />
  );
  return (
    <>
      {enReposo ? (
        <Reposo
          a={a}
          alConfigurarIngreso={nav.alConfigurarIngreso}
          desglose={desglose ? <View style={{ marginTop: espacio.m }}>{desglose}</View> : null}
          pendientes={
            <View style={{ gap: espacio.l }}>
              {encabezado}
              {a.turnos.length > 0 ? conversacion(enPanel ? 'panel' : 'reposo', false) : null}
            </View>
          }
        />
      ) : enPanel ? (
        conversacion(enPanel ? 'panel' : 'reposo', false)
      ) : (
        <View style={{ flex: 1, paddingTop: espacio.m }}>
          {a.vista.estado !== 'sin_ingreso' ? (
            <PildoraDia
              vista={a.vista}
              abierto={a.verDesglose}
              alPresionar={() => a.setVerDesglose((v) => !v)}
            />
          ) : null}
          {desglose ? (
            <View style={{ paddingHorizontal: margenPantalla, paddingTop: espacio.m }}>{desglose}</View>
          ) : null}
          <View style={{ flex: 1 }}>{conversacion('conversacion', true)}</View>
        </View>
      )}
      <View
        testID="hoy-pie-registrar"
        onLayout={(e) => setAltoPie(Math.round(e.nativeEvent.layout.height) + espacio.m)}
        style={{
          paddingHorizontal: enPanel ? 0 : dockVoz.margenLateral,
          paddingTop: espacio.s,
          paddingBottom: enPanel ? 0 : abajo,
        }}
      >
        {/* B+ (D2): fuera de un panel, «Te escucho» tapa toda la pantalla mientras escucha. */}
        <BarraVoz a={a} pantallaCompleta={!enPanel} />
      </View>
    </>
  );
}
