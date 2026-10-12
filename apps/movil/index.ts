/**
 * Entrada de la app. Las tareas en segundo plano se definen antes que Expo Router: el sistema puede arrancar el
 * bundle sin interfaz solo para correrlas (respaldo automático semanal, M9).
 */
import './src/respaldo/tarea';
import 'expo-router/entry';
