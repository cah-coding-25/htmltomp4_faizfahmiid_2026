# HTML-TO-MP4-ENGINE V2.0

Renderer HTML ke MP4 di GitHub Actions dengan Playwright/Chromium, FFmpeg, audio capture PulseAudio, batch processing, pilihan portrait/landscape, sinyal akhir animasi, dan anti-duplikasi SHA-256.

## Pasang ke GitHub
1. Buat repository `HTML-TO-MP4-ENGINE`.
2. Upload seluruh isi folder ini ke branch `main`.
3. Settings → Actions → General → Workflow permissions → pilih **Read and write permissions**.
4. Letakkan HTML dan semua aset lokal (CSS, JS, gambar, audio, font) di folder `HTML/`, gunakan path relatif.
5. Commit/push. Workflow otomatis berjalan. Bisa juga Actions → HTML TO MP4 RENDERER → Run workflow.
6. MP4 tersimpan di `VIDEO/`.

## Durasi auto dan akhir animasi
Default fallback 30 detik. Atur durasi file:
```html
<meta name="render-duration" content="45">
```
Untuk mengakhiri lebih awal, panggil dari JavaScript saat seluruh animasi selesai:
```js
window.HTML_MP4_RENDER_DONE = true;
// atau:
window.dispatchEvent(new Event("html-render-done"));
// atau:
window.dispatchEvent(new Event("render:done"));
```
Tanpa metadata atau sinyal, renderer memakai batas default. Tidak ada cara universal untuk menebak akhir semua animasi CSS/JS secara akurat.

## Orientasi
```html
<meta name="render-orientation" content="portrait">
```
Ganti menjadi `landscape` untuk 16:9. Ukuran khusus dapat diatur dengan atribut `data-render-width` dan `data-render-height` pada tag html. Default ada di `CONFIG/settings.json`. Satu file menghasilkan satu MP4 sesuai orientasinya.

## Audio
Audio aktif secara default. Workflow membuat PulseAudio virtual sink, merekam output audio Chromium, lalu menggabungkannya sebagai AAC. Autoplay diaktifkan melalui kebijakan Chromium. Audio yang memerlukan mikrofon, izin perangkat, interaksi pengguna, atau sumber eksternal yang gagal dimuat tidak dijamin tertangkap. Matikan dengan `audio.enabled=false`.

## Anti-render ulang
SHA-256 konten HTML menjadi identitas. File dilewati hanya jika path dan hash sama, status terakhir success, dan MP4 masih ada. Perubahan isi HTML membuat render baru dan mengganti MP4 pada path output yang sama. Kegagalan tidak dianggap sukses. Database harus tetap disimpan di `DATABASE/`.

## Pengaturan
Edit `CONFIG/settings.json`: durasi default/batas, orientasi, resolusi, FPS, CRF, preset, waktu tunggu, dan audio.

## Batasan
Rendering berjalan real-time; render 60 detik memerlukan kira-kira 60 detik ditambah encoding. GitHub Actions punya batas waktu/kuota. Simpan aset HTML bersama repositori. HTML dianggap tidak tepercaya; jangan masukkan token/rahasia ke halaman. MP4 disimpan di Git biasa sehingga ukuran repo dapat membesar; untuk skala besar pertimbangkan Git LFS.
