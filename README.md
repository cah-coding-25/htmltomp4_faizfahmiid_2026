# 🚀 FAIZ FAHMI ID — WEB TO APK BUILDER

> **Enterprise Android APK Generator powered by GitHub Actions & Native Gradle Build Engine**  
> Creator: **Santri_bersarung (FAIZ_FAHMI_ID)**  
> Master Template Repository: [https://github.com/cah-coding-25/webtoapp_faizfahmiid_2026](https://github.com/cah-coding-25/webtoapp_faizfahmiid_2026)

---

## 📌 1. Gambaran Umum (Overview)

**FAIZ FAHMI ID — WEB TO APK BUILDER** adalah platform developer yang memungkinkan pengguna mengubah website responsif, Progressive Web App (PWA), atau platform SaaS menjadi aplikasi Android native (`.apk` dan `.aab`) tanpa perlu menginstal Android Studio, Gradle, atau mengedit kode secara manual.

Sistem bekerja secara otomatis dengan alur:
```
USER (Input Website + Icon + Settings)
  ↓
Validation & SSRF Protection
  ↓
Generate AppConfig.kt & Contract Schema
  ↓
GitHub API (Branch Isolation 'build/<build-id>')
  ↓
GitHub Actions Workflow Dispatch
  ↓
Android Gradle Runner (Ubuntu VM)
  ↓
Native APK / AAB Artifact & Release
  ↓
Real-Time Progress & Status Polling
  ↓
Direct Download APK to Device
```

---

## 🔒 2. Arsitektur Keamanan (Security Principles)

Aplikasi dibangun dengan prinsip pertahanan berlapis (*defense-in-depth*):
1. **Zero Secret Leakage**: Personal Access Token (PAT) GitHub tidak pernah diekspos ke sisi publik browser atau log mentah. Token disimpan aman di storage terenkripsi lokal dan diakses melalui `BuildConfig`.
2. **SSRF Protection**: Input URL website dan URL Icon divalidasi dengan perlindungan SSRF yang secara otomatis memblokir `localhost`, `127.0.0.1`, loopback, alamat IP privat (`10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`), serta cloud metadata endpoints (`169.254.169.254`).
3. **Android Package Sanitization**: Validasi ketat nama paket Android (e.g. `com.faizfahmiid.myapp`) untuk mencegah karakter ilegal, spasi, tanda hubung, atau kata kunci terlarang bahasa Java/Kotlin.
4. **Isolasi Branch Build**: Masing-masing build diproses pada branch unik sementara (`build/<build-id>`), memastikan tidak ada tabrakan build antarpengguna (*race condition*).
5. **Rate Limiting**: Pembatasan jumlah concurrent builds (default: 2) dan kuota build per jam (default: 10/jam) yang dapat disesuaikan oleh administrator.

---

## ⚙️ 3. Konfigurasi Environment Variables (`.env.example`)

Konfigurasikan variabel environment berikut melalui file `.env` atau Secrets panel:

```bash
# GitHub Authentication & Build Engine
GITHUB_TOKEN=ghp_your_github_personal_access_token_here
GITHUB_OWNER=cah-coding-25
GITHUB_REPOSITORY=webtoapp_faizfahmiid_2026
GITHUB_BRANCH=main
GITHUB_WORKFLOW=android.yml
```

### Izin GitHub Token (Personal Access Token Scopes)
Pastikan token memiliki cakupan izin minimal:
- `repo` (Full control of private repositories)
- `workflow` (Update GitHub Action workflows)
- `actions:write` (Trigger workflow_dispatch)

---

## 🛠️ 4. Struktur Master Android Template (`AppConfig.kt`)

Sistem secara dinamis menghasilkan `app/src/main/java/com/example/AppConfig.kt` pada repositori target:

```kotlin
package com.example

object AppConfig {
    const val WEB_URL = "https://example.com"
    const val APP_TITLE = "Example App"
    const val SHOW_TOP_BAR = false
    const val ENABLE_PULL_TO_REFRESH = true
    const val ALLOW_EXTERNAL_INTENTS = true
    const val DESKTOP_MODE = false
    const val ENABLE_OFFLINE_PWA_MODE = false
    const val CLEAR_CACHE_ON_START = false
    const val ENABLE_WEB_SHARE = true
}
```

---

## 📱 5. Fitur Aplikasi

- **Interactive Device Preview**: Mockup smartphone Android dengan status bar, notch, URL bar, dan responsivitas konfigurasi live.
- **Workflow Dispatch Engine**: Komunikasi REST API langsung ke GitHub v3 (`/actions/workflows/{id}/dispatches`).
- **Real-Time Stage Monitor**:
  - `Configuration validated`
  - `Build request created`
  - `GitHub Actions started`
  - `Android project prepared`
  - `Gradle build running`
  - `APK packaging`
  - `Download Ready`
- **Build Center**: Kartu sukses beranimasi dengan tombol langsung `⬇ DOWNLOAD APK`, serta kartu kesalahan informatif dengan opsi `RETRY BUILD`.
- **Local Persistence (Room Database)**: Menyimpan riwayat build, statistik build, konfigurasi admin, dan log secara offline.
- **Admin Dashboard**:
  - Autentikasi PIN (Default: `1234`)
  - Status koneksi GitHub dan pemantauan sisa quota API
  - Tombol `TEST GITHUB CONNECTION`
  - Tombol `TEST BUILD` dengan konfigurasi demo
  - Pengaturan batas concurrent build dan per-jam.

---

## 🧪 6. Menjalankan Uji Coba (Testing)

Jalankan Robolectric unit tests melalui Gradle:
```bash
gradle :app:testDebugUnitTest
```

---

## 👨‍💻 7. Developer & Attribution

* **Platform**: FAIZ FAHMI ID — WEB TO APK BUILDER
* **Made with ❤️ by FAIZ_FAHMI_ID | Santri_bersarung**
* **Contact**: caheducation25@gmail.com
