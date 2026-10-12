package com.example.domain

import android.content.Context
import android.content.Intent
import android.os.Environment
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream

object TemplateZipManager {

    /**
     * Copies template ZIP from assets to external storage and opens share/save sheet
     */
    fun exportZipToUserStorage(context: Context): Result<File> {
        return try {
            val assetName = "github_template_webtoapp.zip"
            val targetDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                ?: context.filesDir
            val targetFile = File(targetDir, "webtoapp_github_template.zip")

            context.assets.open(assetName).use { input ->
                FileOutputStream(targetFile).use { output ->
                    input.copyTo(output)
                }
            }

            // Launch sharing/saving intent
            val fileUri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                targetFile
            )

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "application/zip"
                putExtra(Intent.EXTRA_STREAM, fileUri)
                putExtra(Intent.EXTRA_SUBJECT, "WebToApp GitHub Template Engine")
                putExtra(Intent.EXTRA_TEXT, "File template repositori GitHub untuk Web To App Engine.")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            val chooser = Intent.createChooser(shareIntent, "Simpan / Bagikan Template ZIP GitHub")
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(chooser)

            Result.success(targetFile)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Map of essential file paths and source contents for One-Click Push to GitHub
     */
    fun getEssentialEngineFiles(): Map<String, String> {
        val workflowYaml = """
name: Faiz Fahmi ID - Android Web To App Builder

on:
  workflow_dispatch:
    inputs:
      build_id:
        description: 'Unique Build ID'
        required: true
        default: 'FAIZ-BUILD-DEMO'
      web_url:
        description: 'Website URL to wrap'
        required: true
        default: 'https://example.com'
      app_title:
        description: 'Application Title'
        required: true
        default: 'Faiz App'
      package_name:
        description: 'Android Package Name'
        required: false
        default: 'com.faizfahmiid.myapp'
      build_type:
        description: 'Build Type'
        required: false
        default: 'apk'
      show_url_bar:
        description: 'Show URL Address Bar (true/false)'
        required: false
        default: 'false'

jobs:
  build:
    name: Build Android APK
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'
          cache: 'gradle'
      - name: Grant Execute Permission
        run: chmod +x gradlew || true
      - name: Build APK
        run: ./gradlew assembleDebug --stacktrace --no-daemon
      - name: Collect APK
        run: |
          mkdir -p output_artifacts
          find app/build/outputs/apk/ -name "*.apk" -exec cp {} output_artifacts/${'$'}{{ github.event.inputs.build_id }}.apk \;
      - name: Upload APK
        uses: actions/upload-artifact@v4
        with:
          name: app-apk-${'$'}{{ github.event.inputs.build_id }}
          path: output_artifacts/*.apk
          retention-days: 14
""".trimIndent()

        val rootBuildGradle = """
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.kotlin.serialization) apply false
}
""".trimIndent()

        val settingsGradle = """
pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "WebToApp Engine"
include(":app")
""".trimIndent()

        val gradleProperties = """
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
kotlin.code.style=official
""".trimIndent()

        val wrapperProperties = """
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.9-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
""".trimIndent()

        val appBuildGradle = """
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.kotlin.serialization)
}

android {
    namespace = "com.example"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.faizfahmiid.webtoapp"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
}
""".trimIndent()

        val defaultAppConfig = """
package com.example

object AppConfig {
    const val WEB_URL = "https://example.com"
    const val APP_TITLE = "WebToApp"
    const val SHOW_TOP_BAR = false
    const val SHOW_URL_BAR = false
    const val ENABLE_PULL_TO_REFRESH = true
    const val ALLOW_EXTERNAL_INTENTS = true
    const val DESKTOP_MODE = false
    const val ENABLE_OFFLINE_PWA_MODE = false
    const val CLEAR_CACHE_ON_START = false
    const val ENABLE_WEB_SHARE = true
}
""".trimIndent()

        val themesXml = """
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.MyApplication" parent="android:Theme.DeviceDefault.NoActionBar">
        <item name="android:windowBackground">@drawable/splash_screen_background</item>
        <item name="android:statusBarColor">#080D1A</item>
        <item name="android:navigationBarColor">#080D1A</item>
    </style>
</resources>
""".trimIndent()

        val gitignore = """
*.iml
.gradle
/local.properties
/.idea/
.DS_Store
/build
/captures
.externalNativeBuild
.cxx
local.properties
""".trimIndent()

        val readme = """
# Faiz Fahmi ID - Web To App GitHub Actions Engine

Repositori ini adalah mesin kompilasi otomatis Android native berbasis GitHub Actions.

## Cara Kerja
1. Aplikasi Android mengirimkan konfigurasi URL target dan branding (`AppConfig.kt`).
2. GitHub Actions memicu workflow `.github/workflows/build_apk.yml`.
3. Runner Ubuntu mengompilasi APK Android secara otomatis menggunakan Gradle.
4. File APK siap didownload melalui tab Actions Artifacts.
""".trimIndent()

        return mapOf(
            ".github/workflows/build_apk.yml" to workflowYaml,
            "build.gradle.kts" to rootBuildGradle,
            "settings.gradle.kts" to settingsGradle,
            "gradle.properties" to gradleProperties,
            "gradle/wrapper/gradle-wrapper.properties" to wrapperProperties,
            "app/build.gradle.kts" to appBuildGradle,
            "app/src/main/java/com/example/AppConfig.kt" to defaultAppConfig,
            "app/src/main/res/values/themes.xml" to themesXml,
            ".gitignore" to gitignore,
            "README.md" to readme
        )
    }
}
