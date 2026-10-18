import { Texto } from '../../ui';

/** Copy secundario cuando una sección no tiene filas (`02 §10`, `02 §11`). */
export function EstadoVacio({ texto, testID }: { texto: string; testID: string }) {
  return (
    <Texto variante="cuerpo" tono="secundario" testID={testID}>
      {texto}
    </Texto>
  );
}
