// Prueba en la JVM la lógica pura de la captura (sin Android): filtro de lista blanca,
// extracción, cola JSONL, diagnóstico y catálogos. Compila las mismas fuentes que el módulo
// de Android (`../android/src/main/java/com/finanvoz/captura/nucleo`).
//
//   gradle -p modules/captura-android/nucleo-jvm test            (la primera vez descarga el plugin)
//   gradle -p modules/captura-android/nucleo-jvm test --offline  (después)
plugins {
  kotlin("jvm") version "2.0.21"
}

repositories {
  mavenCentral()
}

dependencies {
  testImplementation("junit:junit:4.13.2")
}

// Bytecode 17 como en Android, con el JDK que haya (sin descargar toolchains).
java {
  sourceCompatibility = JavaVersion.VERSION_17
  targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
  compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
  sourceSets["main"].kotlin.srcDir("../android/src/main/java/com/finanvoz/captura/nucleo")
}

tasks.test {
  // Raíz del módulo y del repositorio, para leer los catálogos y fixtures/ reales.
  systemProperty("captura.modulo", projectDir.parentFile.absolutePath)
  systemProperty("captura.repo", projectDir.parentFile.parentFile.parentFile.absolutePath)
  testLogging {
    events("passed", "failed")
    exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
  }
}
