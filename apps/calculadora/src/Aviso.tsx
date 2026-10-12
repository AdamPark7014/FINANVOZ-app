import { MARCA, RESPONSABLE, RESPONSABLE_DEFINIDO, VERSION_AVISO } from './config';

const PENDIENTE = '[pendiente de definir]';

/** Aviso de privacidad integral de la lista de espera (`docs/08-CUMPLIMIENTO.md §2` y §2.1). */
export function Aviso() {
  const nombre = RESPONSABLE.nombre || PENDIENTE;
  const correo = RESPONSABLE.correo || PENDIENTE;
  return (
    <main className="aviso-integral">
      <p>
        <a href="./">← Volver a la calculadora</a>
      </p>
      <h1>Aviso de privacidad de la lista de espera de {MARCA}</h1>
      <p className="ayuda">Versión {VERSION_AVISO}</p>
      {!RESPONSABLE_DEFINIDO && (
        <p className="error" role="alert">
          Borrador: falta la identidad del responsable. Este aviso no se publica así.
        </p>
      )}

      <h2>Quién es responsable de tus datos</h2>
      <p>
        {nombre}, con domicilio en {RESPONSABLE.domicilio || PENDIENTE}, es responsable del tratamiento de tus
        datos personales. Contacto: {correo}.
      </p>

      <h2>Qué datos tratamos</h2>
      <ul>
        <li>Tu correo electrónico.</li>
        <li>
          Tus respuestas a cuatro preguntas: qué teléfono usas, si tu banco te avisa de cada compra, cuánto
          pagarías al mes y para qué usarías la app.
        </li>
        <li>La versión de este aviso que aceptaste y la fecha y hora en que lo aceptaste.</li>
        <li>
          Para evitar abusos, una huella irreversible de tu dirección IP que se borra a las 24 horas. No
          guardamos la dirección IP.
        </li>
      </ul>
      <p>
        <strong>Los montos que escribes en la calculadora no salen de tu navegador.</strong> No los recibimos
        ni los guardamos.
      </p>

      <h2>Para qué los usamos</h2>
      <p>
        Avisarte del lanzamiento, invitarte a la beta y entender qué necesita la gente para decidir qué
        construir.
      </p>
      <p>No usamos tus datos para otros fines, no los vendemos y no los compartimos para publicidad.</p>

      <h2>Quién más los trata</h2>
      <p>
        Supabase Inc. los guarda por cuenta nuestra como encargado, en servidores que pueden estar fuera de
        México. Si en el futuro usamos un servicio de envío de correos, lo agregaremos a este aviso antes de
        usarlo.
      </p>

      <h2>Cómo darte de baja y ejercer tus derechos</h2>
      <p>
        Cada correo trae un enlace para darte de baja. También puedes escribir a {correo} para acceder a tus
        datos, corregirlos, pedir que los borremos, oponerte a su uso o revocar tu consentimiento. Te
        respondemos en los plazos que marca la Ley Federal de Protección de Datos Personales en Posesión de
        los Particulares.
      </p>

      <h2>Cuánto tiempo los guardamos</h2>
      <p>Hasta que te des de baja o hasta 12 meses después del lanzamiento público, lo que pase primero.</p>

      <h2>Cambios a este aviso</h2>
      <p>
        Publicaremos cualquier cambio en esta página con una nueva versión y fecha. Si el cambio es
        importante, te avisaremos por correo.
      </p>
    </main>
  );
}
