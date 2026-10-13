import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing stays under the owner's control. Create android/key.properties
// (never committed) pointing at the owner's upload keystore; see flutter_app/docs/RELEASE.md.
// tool/make_upload_key.ps1 creates both. Without it, release builds are debug-signed.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseKey = keystorePropertiesFile.exists()
if (hasReleaseKey) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "in.mockmob.app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // Needed by flutter_local_notifications (java.time on older Android versions).
        isCoreLibraryDesugaringEnabled = true
    }

    defaultConfig {
        applicationId = "in.mockmob.app"
        // Android 7.0 (API 24) is the floor of every plugin we use and still covers virtually
        // every budget phone in India. Pinned so a Flutter upgrade cannot raise it silently.
        minSdk = 24
        // Google Play requires targetSdk 36 (Android 16) for new apps and updates from
        // 31 Aug 2026. Never goes below 36; follows Flutter when Flutter moves higher.
        targetSdk = maxOf(flutter.targetSdkVersion, 36)
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKey) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            // Without the owner's key.properties, release builds fall back to debug signing
            // so local release-mode testing still works. Such builds must never be uploaded.
            signingConfig = if (hasReleaseKey) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
            // R8 code shrinking and resource shrinking are switched on by the Flutter Gradle plugin
            // for release builds, and it picks up android/app/proguard-rules.pro (plugin keep
            // rules live there). Native symbol tables go into the AAB so Play Console can
            // symbolicate native crashes.
            ndk { debugSymbolLevel = "SYMBOL_TABLE" }
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
