# TAPPA Design & Build

Website portofolio statis TAPPA untuk GitHub Pages. Tidak perlu proses build.

## Struktur

- `index.html`: halaman utama dengan hero parallax, proyek unggulan, portofolio, pendekatan, dan brief proyek.
- `assets/css/tappa.css`: desain responsif dan efek parallax/reveal.
- `assets/js/projects.js`: data 11 proyek dan 162 foto (dari `Tappa_Portofolio_Desain_Interior_20261014.pptx`).
- `assets/js/tappa.js`: filter, pencarian, galeri, parallax, dan brief.
- `assets/js/site-config.js`: kontak resmi (WhatsApp, email, Instagram). Kosongkan jika belum ada.
- `assets/photos/`: foto WebP (lebar maksimal 1600px). `hero-cover.webp` adalah sampul PPTX.
- `demo-3d/` dan `rab/`: prototipe 3D Showroom dan RAB.
- `sketchup-3d/`: showcase model 3D bergaya SketchUp yang dibangun dari `rab/data/demo-project.json` (klik elemen untuk melihat data & biaya).

## Menjalankan secara lokal

```bash
npx http-server -p 8080 .
```

## Publikasi

Settings → Pages → Deploy from a branch → `main` / root.
