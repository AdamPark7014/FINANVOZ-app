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
  // M15: Apache PDFBox 2.0.27 es la versión que porta PdfBox-Android 2.0.27.0 (`android/build.gradle`); prueba
  // con los PDF sintéticos de fixtures/pdf el mismo extractor (PDFTextStripper ordenado por posición).
  testImplementation("org.apache.pdfbox:pdfbox:2.0.27")
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

// Verificación opcional de las clases de Android (servicio, módulo, adaptador): las compila
// contra el framework de Android de Robolectric (android-all, API 34) y firmas mínimas de
// expo-modules-core (src/stubsExpo). No ejecuta nada; detecta errores de tipos o de API.
//   gradle -p modules/captura-android/nucleo-jvm verificarAndroid   (descarga ~140 MB la primera vez)
val android by sourceSets.creating
kotlin.sourceSets["android"].kotlin.apply {
  srcDir("../android/src/main/java")
  srcDir("../android/src/release/java")
  srcDir("src/stubsExpo/kotlin")
}
// PdfBox-Android se publica como AAR: se extrae su classes.jar para compilar `EstadoCuentaPdf.kt` (M15).
val aarPdfbox by configurations.creating { isTransitive = false }
val extraerPdfbox by tasks.registering(Copy::class) {
  from({ zipTree(aarPdfbox.singleFile) }) { include("classes.jar") }
  into(layout.buildDirectory.dir("pdfbox-android"))
}
dependencies {
  "androidCompileOnly"("org.robolectric:android-all:14-robolectric-10818077")
  aarPdfbox("com.tom-roush:pdfbox-android:2.0.27.0@aar")
  "androidCompileOnly"(files(layout.buildDirectory.file("pdfbox-android/classes.jar")).builtBy(extraerPdfbox))
}
tasks.register("verificarAndroid") {
  group = "verification"
  description = "Compila el código Android del módulo contra android-all y firmas de Expo."
  dependsOn("compileAndroidKotlin")
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
