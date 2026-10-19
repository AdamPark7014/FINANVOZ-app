import { configure } from '@testing-library/react-native';

// Los botones y avisos esconden su texto interno a TalkBack (lo anuncia la etiqueta del contenedor);
// las pruebas siguen buscando ese texto visible, así que las consultas incluyen elementos ocultos.
configure({ defaultIncludeHiddenElements: true });
