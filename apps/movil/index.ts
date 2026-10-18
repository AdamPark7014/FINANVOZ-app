/**
 * Entrada de la app. Las tareas en segundo plano se definen antes que Expo Router: el sistema puede arrancar el
 * bundle sin interfaz solo para correrlas (respaldo automático semanal, M9; widget "Hoy puedes", M10; gastos
 * compartidos, M16; apertura del día).
 */
import './src/respaldo/tarea';
import './src/widget/tarea';
import './src/compartido/tarea';
import './src/tareas/diaria';
import 'expo-router/entry';
