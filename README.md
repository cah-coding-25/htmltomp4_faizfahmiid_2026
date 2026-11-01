# 🎬 HTML-TO-MP4-ENGINE V2.0

### Automated HTML to MP4 Rendering Engine

**Turn HTML Animations into Professional MP4 Videos — Automatically.**

<p align="center">
  <strong>BY: FAIZ_FAHMI_ID</strong>
</p>

---

## 🚀 Overview

**HTML-TO-MP4-ENGINE** adalah sistem otomatisasi rendering yang dirancang untuk mengubah dokumen HTML menjadi video MP4 menggunakan teknologi browser automation dan video processing.

Dengan memanfaatkan GitHub Actions, Python, Playwright, Chromium, FFmpeg, dan PulseAudio, pengguna dapat mengirimkan file HTML ke repositori GitHub dan menjalankan proses rendering tanpa harus melakukan konversi video secara manual di komputer.

Sistem ini dirancang untuk kreator motion graphic, animator HTML, pengembang web, pembuat konten digital, serta pengguna yang sering membuat animasi menggunakan HTML, CSS, SVG, Canvas, dan JavaScript.

**Workflow sederhana:**

1. Masukkan file HTML ke folder `HTML/`.
2. Jalankan GitHub Actions atau lakukan push.
3. Sistem mendeteksi file yang perlu dirender.
4. Browser Chromium menjalankan animasi HTML.
5. FFmpeg mengonversi hasil rekaman menjadi MP4.
6. Video otomatis disimpan ke folder `VIDEO/`.

**One HTML. One Workflow. One MP4.**

---

## 🎯 The Problem

Proses mengubah animasi HTML menjadi video sering kali membutuhkan pekerjaan tambahan yang cukup merepotkan.

Beberapa permasalahan yang ingin diselesaikan oleh proyek ini:

| Permasalahan | Solusi |
|---|---|
| HTML hanya dapat ditampilkan melalui browser | Chromium menjalankan HTML secara otomatis |
| Harus merekam layar secara manual | Browser recording otomatis |
| Harus mengonversi rekaman menjadi MP4 | FFmpeg menangani encoding |
| Banyak HTML harus dirender satu per satu | Batch rendering |
| File yang sama ter-render berulang kali | SHA-256 duplicate detection |
| Sulit mengetahui status rendering | Render manifest dan history |
| Membutuhkan pengaturan video berulang kali | Konfigurasi terpusat |
| Proses rendering bergantung pada komputer lokal | GitHub Actions cloud runner |

## 💡 The Solution

HTML-TO-MP4-ENGINE menghadirkan sistem rendering otomatis berbasis repositori GitHub.

Pengguna tidak perlu menjalankan perintah Python setiap kali ingin mengonversi HTML.

Cukup unggah file ke folder yang telah disediakan, kemudian jalankan workflow.

Sistem akan memindai seluruh file HTML, memeriksa riwayat rendering, menjalankan browser, merekam animasi, mengonversi hasilnya menjadi MP4, dan menyimpan hasil akhir ke repositori.

---

## ✨ Key Features

### 1. Automated HTML Rendering

Menjalankan dokumen HTML menggunakan Chromium Headless.

Mendukung:
- HTML5.
- CSS3.
- JavaScript.
- SVG Vector.
- HTML Canvas.
- CSS Animation.
- JavaScript Animation.
- Transitions dan Transformations.
- Font dan gambar yang dapat dimuat browser.

### 2. Automatic MP4 Conversion

Menggunakan FFmpeg untuk mengonversi rekaman browser menjadi MP4.

Pengaturan default:
- Video format: MP4.
- Video codec: H.264.
- Pixel format: YUV420p.
- Frame rate: 30 FPS.
- Encoding quality: CRF 20.
- Fast Start: Enabled.

### 3. Portrait & Landscape Support

Mendukung dua orientasi video.

| Orientasi | Resolusi |
|---|---|
| Portrait 9:16 | 1080 × 1920 |
| Landscape 16:9 | 1920 × 1080 |

Orientasi dapat ditentukan melalui metadata HTML atau konfigurasi repositori.

### 4. Automatic Duration Management

Sistem dapat membaca durasi rendering melalui metadata HTML.

Contoh:

```html
<meta name="render-duration" content="30">
```

Jika metadata tidak tersedia, sistem menggunakan durasi default dari `CONFIG/settings.json`.

Sistem juga mendukung sinyal penyelesaian animasi melalui JavaScript:

```javascript
window.HTML_MP4_RENDER_DONE = true;
```

Alternatif:

```javascript
window.dispatchEvent(
  new Event("html-render-done")
);
```

Dengan mekanisme tersebut, halaman dapat memberikan sinyal bahwa animasi telah selesai sebelum batas durasi tercapai.

### 5. Audio Recording

V2.0 mendukung perekaman output audio browser menggunakan PulseAudio dan FFmpeg.

Fitur:
- Virtual audio sink.
- Browser audio capture.
- Audio synchronization.
- AAC audio encoding.
- Audio dan video merging.

Pengaturan audio dapat diaktifkan atau dinonaktifkan melalui konfigurasi.

### 6. Smart Duplicate Detection

Menggunakan algoritma SHA-256 untuk mengenali isi file HTML.

Sistem tidak hanya memeriksa nama file, tetapi juga memeriksa identitas kontennya.

| Kondisi | Tindakan |
|---|---|
| HTML baru | Render |
| HTML sudah dirender | Skip |
| HTML tidak berubah | Skip |
| HTML mengalami perubahan | Render ulang |
| Rendering gagal | Dapat dicoba kembali |
| MP4 hilang | Render kembali |
| HTML dihapus | MP4 lama tetap dipertahankan |

Dengan sistem ini, menjalankan workflow berulang kali tidak otomatis menghasilkan video duplikat.

### 7. Batch Rendering

Sistem mendukung banyak file HTML dalam satu kali workflow.

Contoh:

```text
HTML/
├── intro.html
├── outro.html
├── scene-01.html
├── scene-02.html
├── scene-03.html
└── animation/
    ├── motion-01.html
    └── motion-02.html
```

Semua file akan dipindai dan diproses secara berurutan.

### 8. Render History & Database

Sistem menyimpan riwayat proses rendering melalui:

- `render_manifest.json`
- `render_history.json`

Informasi yang disimpan meliputi:
- Nama file HTML.
- SHA-256 hash.
- Status rendering.
- Nama output MP4.
- Durasi video.
- Resolusi.
- Frame rate.
- Informasi audio.
- Waktu rendering.
- Pesan kesalahan jika gagal.

### 9. GitHub Actions Automation

Mendukung dua metode eksekusi:

**Automatic Trigger**
- Saat HTML baru diunggah.
- Saat HTML diperbarui.
- Saat konfigurasi rendering berubah.

**Manual Trigger**
- Melalui GitHub Actions.
- Menggunakan tombol Run workflow.

Hasil video dan database dapat disimpan kembali ke repositori melalui GitHub Actions.

---

## 🏗️ Project Architecture

```text
HTML-TO-MP4-ENGINE/
│
├── HTML/
│   ├── intro.html
│   ├── scene-01.html
│   └── scene-02.html
│
├── VIDEO/
│   ├── intro.mp4
│   ├── scene-01.mp4
│   └── scene-02.mp4
│
├── ENGINE/
│   ├── __init__.py
│   └── main.py
│
├── DATABASE/
│   ├── render_manifest.json
│   └── render_history.json
│
├── CONFIG/
│   └── settings.json
│
├── LOGS/
│   └── render.log
│
├── TEMP/
│
├── .github/
│   └── workflows/
│       └── render-html.yml
│
├── requirements.txt
├── .gitignore
├── .gitattributes
└── README.md
```

### Folder Description

| Folder | Description |
|---|---|
| `HTML/` | Penyimpanan dokumen HTML sumber dan aset pendukung |
| `VIDEO/` | Penyimpanan hasil rendering MP4 |
| `ENGINE/` | Mesin utama pemrosesan dan rendering |
| `DATABASE/` | Database status dan riwayat |
| `CONFIG/` | Pengaturan rendering |
| `LOGS/` | Catatan aktivitas dan error |
| `TEMP/` | Penyimpanan sementara hasil capture |
| `.github/` | Konfigurasi GitHub Actions |

---

## ⚙️ Technology Stack

| Technology | Function |
|---|---|
| Python 3.12 | Core automation engine |
| Playwright | Browser automation |
| Chromium | HTML execution and recording |
| FFmpeg | Video and audio processing |
| PulseAudio | Audio capture |
| GitHub Actions | Cloud automation |
| SHA-256 | Content identification |
| JSON | Configuration and database |

---

## 📥 Installation Guide

### Step 1 — Create GitHub Repository

Buat repositori baru dengan nama:

`HTML-TO-MP4-ENGINE`

Upload seluruh file proyek ke branch `main`.

### Step 2 — Configure GitHub Permissions

Buka:

`Settings → Actions → General → Workflow permissions`

Aktifkan:

**Read and write permissions**

Pengaturan ini diperlukan agar GitHub Actions dapat menyimpan hasil MP4 dan database ke repositori.

### Step 3 — Upload HTML Files

Masukkan dokumen HTML ke folder:

`HTML/`

Contoh:

```text
HTML/
├── animation-01.html
├── animation-02.html
└── animation-03.html
```

Jika HTML membutuhkan CSS, JavaScript, gambar, atau audio eksternal lokal, sertakan aset tersebut di folder yang sesuai.

Gunakan path relatif agar browser dapat memuat aset dengan benar.

### Step 4 — Run GitHub Actions

Buka tab:

`Actions → HTML TO MP4 RENDERER`

Pilih:

`Run workflow`

Atau cukup commit dan push file HTML untuk memicu workflow otomatis.

### Step 5 — Get Your MP4

Setelah rendering berhasil, hasil video akan tersedia di:

`VIDEO/`

Contoh:

```text
VIDEO/
├── animation-01.mp4
├── animation-02.mp4
└── animation-03.mp4
```

---

## 🎛️ Configuration

Semua pengaturan utama tersedia di:

`CONFIG/settings.json`

Contoh konfigurasi:

```json
{
  "duration": {
    "mode": "auto",
    "default_seconds": 30,
    "min_seconds": 1,
    "max_seconds": 300,
    "allow_early_done_signal": true
  },
  "video": {
    "default_orientation": "landscape",
    "portrait": {
      "width": 1080,
      "height": 1920
    },
    "landscape": {
      "width": 1920,
      "height": 1080
    },
    "fps": 30,
    "codec": "libx264",
    "crf": 20,
    "preset": "veryfast"
  },
  "audio": {
    "enabled": true,
    "sample_rate": 48000,
    "channels": 2,
    "bitrate": "192k"
  }
}
```

Pengguna dapat menyesuaikan resolusi, kualitas video, durasi, frame rate, dan audio sesuai kebutuhan.

---

## 🛡️ Advantages

**Why HTML-TO-MP4-ENGINE?**

- **No Manual Screen Recording:** Tidak perlu merekam layar sendiri.
- **Cloud-Based Rendering:** Proses rendering menggunakan GitHub Actions.
- **Smart Processing:** Hanya HTML yang membutuhkan rendering yang diproses.
- **Efficient Workflow:** Banyak file dapat diproses dalam satu workflow.
- **Consistent Output:** Pengaturan video terpusat.
- **Persistent Database:** Status rendering tetap tersimpan.
- **Flexible Orientation:** Mendukung format portrait dan landscape.
- **Audio Support:** Mendukung capture audio browser.
- **Developer Friendly:** Struktur proyek sederhana dan mudah dikembangkan.
- **Automated Output:** Hasil MP4 dapat langsung disimpan ke GitHub.

---

## ⚠️ Important Notes & Limitations

1. Rendering berjalan secara real-time. Video berdurasi 60 detik membutuhkan waktu perekaman kurang lebih 60 detik, ditambah waktu encoding.
2. Deteksi akhir animasi memerlukan metadata durasi atau sinyal JavaScript. Sistem tidak dapat mengetahui secara universal kapan semua animasi HTML selesai.
3. Audio capture bergantung pada konfigurasi audio browser dan PulseAudio. Audio yang memerlukan mikrofon, izin khusus, atau interaksi pengguna tidak dijamin tertangkap.
4. HTML yang menggunakan sumber eksternal membutuhkan koneksi internet dan akses ke sumber tersebut.
5. GitHub Actions memiliki batas waktu, kuota penggunaan, dan batas ukuran penyimpanan.
6. Penyimpanan MP4 langsung di Git dapat memperbesar ukuran repositori. Untuk proyek berskala besar, pertimbangkan Git LFS.
7. Perlakukan HTML sebagai konten tidak tepercaya. Jangan memasukkan token atau informasi rahasia ke dalam dokumen HTML.

---

## 🧪 Project Testing

Gunakan file demo yang tersedia di:

`HTML/demo-portrait-audio.html`

File tersebut dirancang untuk menguji:
- HTML rendering.
- Portrait resolution.
- CSS animation.
- Browser recording.
- Audio playback.
- MP4 encoding.

Setelah workflow selesai, periksa hasil di folder `VIDEO/` dan pastikan video dapat diputar.

---

## 🗺️ Development Roadmap

| Version | Development |
|---|---|
| V1.0 | Basic HTML to MP4 automation |
| V2.0 | Audio capture, orientation support, render signals, smart duplicate detection |
| V2.1 | Improved rendering diagnostics and retry management |
| V3.0 | Web-based rendering dashboard |
| V3.1 | Queue management and advanced batch processing |
| V4.0 | Advanced rendering profiles and project management |

*Roadmap merupakan rencana pengembangan, bukan fitur yang sudah tersedia.*

---

## 👨‍💻 Developer

**BY: FAIZ_FAHMI_ID**

Project: HTML-TO-MP4-ENGINE  
Version: 2.0  
Category: HTML Video Rendering Automation  
Platform: GitHub Actions  
Primary Language: Python

---

## 📜 License & Ownership

Copyright © FAIZ_FAHMI_ID.

Hak cipta dan kepemilikan proyek mengikuti ketentuan pemiliknya.

Penggunaan, penyalinan, distribusi, modifikasi, maupun penggunaan komersial harus memperoleh izin dari pemilik proyek apabila diwajibkan oleh ketentuan lisensinya.

Tidak ada lisensi open-source yang diberikan melalui dokumentasi ini.

---

<p align="center">
  <strong>HTML IN. MP4 OUT.</strong>
  <br>
  <strong>Automate Your Creativity.</strong>
  <br><br>
  <strong>BY: FAIZ_FAHMI_ID</strong>
</p>
