import { Icono } from '../util/Icono';

/**
 * La pantalla de inicio de la app como se ve hoy (placa pino con la cifra del día, plática y dock de voz), con una
 * escena en bucle hecha solo con CSS: dices «tacos 80 en efectivo», el asistente lo anota y tu día baja de $412 a
 * $332. Con «reducir movimiento» se queda fija en el resultado. Las cifras son de ejemplo.
 */
export function MaquetaTelefono() {
  return (
    <div
      className="telefono"
      role="img"
      aria-label="Pantalla de Finanvoz: hoy puedes gastar 412 pesos; dices «tacos 80 en efectivo», el asistente lo anota y te quedan 332 pesos para hoy"
    >
      <div className="telefono-pantalla" aria-hidden="true">
        <div className="tel-placa">
          <div className="tel-nav">
            <span className="tel-nav-activa">Asistente</span>
            <span>Movimientos</span>
            <span>Cuentas</span>
            <span className="tel-tu">Tú</span>
          </div>
          <p className="tel-saludo">
            <span className="tel-orbe-chico" />
            Buenos días
          </p>
          <p className="tel-etiqueta">Hoy puedes gastar</p>
          <p className="tel-cifra num">
            <span className="tel-cifra-rollo">
              <span>$412</span>
              <span>$332</span>
            </span>
            <small>al día</small>
          </p>
          <p className="tel-hasta">hasta tu quincena del lun 30, en 5 días.</p>
        </div>
        <div className="tel-platica">
          <div className="tel-burbuja-tu">
            <Icono nombre="microfono" tamano={12} />
            tacos 80 en efectivo
          </div>
          <div className="tel-respuesta">
            <span className="tel-orbe-chico" />
            Listo, lo anoté.
          </div>
          <div className="tel-registro">
            <span className="tel-mosaico" />
            <span className="tel-registro-nombre">
              Tacos
              <small>Comida fuera · Efectivo</small>
            </span>
            <span className="tel-registro-monto num">$80</span>
          </div>
        </div>
        <div className="tel-dock">
          <span>Escribir</span>
          <span className="tel-mic">
            <Icono nombre="microfono" tamano={24} />
          </span>
          <span>¿Me alcanza?</span>
        </div>
      </div>
    </div>
  );
}
