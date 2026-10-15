# TAPPA Design and Build

Website portofolio statis TAPPA untuk GitHub Pages. Identitas visual memakai logo asli TAPPA dan palet gading, arang, serta emas.

## Materi proyek

11 kelompok proyek dan 162 gambar berasal dari materi yang diberikan pemilik. Nama mengikuti label portofolio. Jenis media membedakan foto bangunan/interior, visualisasi 3D, denah, dan dokumentasi pekerjaan. Tidak ada penambahan tahun pelaksanaan, biaya, luas, kredit desain, atau testimoni yang belum dikonfirmasi.

- `index.html`: halaman perusahaan dan portofolio.
- `assets/css/tappa.css`: desain responsif.
- `assets/js/projects.js`: indeks 11 proyek dan 162 foto.
- `assets/photos/`: gambar WebP dari foto portofolio.
- `assets/brand/tappa-logo.png`: logo yang diberikan pemilik, tanpa perubahan isi.
- `assets/js/tappa.js`: filter, pencarian, galeri, tautan proyek, dan brief lokal.
- `assets/js/site-config.js`: kontak resmi yang dapat diisi setelah dikonfirmasi.

## Interaksi

Filter kategori dan pencarian berdasarkan nama/lokasi. Album mendukung tombol foto, thumbnail, panah keyboard, Esc, dan tautan langsung `?proyek=<slug>&foto=<nomor>`. Brief proyek dapat disalin, diunduh, atau dibagikan melalui fitur perangkat. Brief tidak otomatis dikirim atau disimpan di server.

Tautan lama `/demo-3d/` mengarah ke portofolio dan `/rab/` ke penyusunan brief. Data contoh dan model procedural sebelumnya telah dihapus dari situs yang diterbitkan.

## Publikasi

Situs buildless, tanpa paket eksternal. GitHub Pages menggunakan cabang `main` dan direktori root. Nama repositori dipertahankan agar URL yang sudah dibagikan tetap berlaku.

## Kontak resmi

Isi `whatsapp` di `assets/js/site-config.js` dengan nomor resmi dalam format internasional berupa digit, tanpa tanda `+`. Kontak kosong tidak ditampilkan. Jangan mengisi nomor, alamat, atau akun contoh.
