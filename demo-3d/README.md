# Interactive 3D Showroom MVP

Prototype ini dibuat sebagai fondasi experience website Ruang Nara tanpa mengubah website utama.

## Flow

1. MapLibre menampilkan konteks proyek dan massa bangunan 3D.
2. Klik marker / Enter 3D House untuk masuk ke viewer arsitektur.
3. Viewer Three.js menampilkan mockup bangunan procedural yang dapat di-orbit dan di-zoom.
4. Mode 360 menampilkan ruang interior procedural dan contoh hotspot material.

## Kenapa procedural dulu?

MVP ini tidak membutuhkan file SketchUp, GLB, maupun panorama asli sehingga UX dan deployment dapat diuji lebih cepat. Setelah pipeline disetujui, mockup dapat diganti menjadi:

- `SketchUp -> GLB -> Three.js GLTFLoader`
- `Insta360 / Ricoh Theta -> equirectangular JPG -> 360 viewer`
- Project coordinates / GeoJSON -> MapLibre

## Cara menjalankan

Folder ini static dan dapat diserve langsung oleh Nginx, GitHub Pages, `python -m http.server`, atau web server lain.

Contoh lokal:

```bash
python3 -m http.server 8080
```

Lalu buka:

```text
http://localhost:8080/demo-3d/
```

## Target integrasi berikutnya

- GLTFLoader untuk file `.glb` hasil ekspor SketchUp
- Panorama equirectangular asli
- Hotspot yang disimpan sebagai data JSON
- Project registry (`projects.json` atau API)
- Material configurator
- Before / after design vs delivered
- Lead / quotation form
- Analytics event untuk map -> 3D -> 360 -> contact

## Struktur

```text
demo-3d/
  index.html
  styles.css
  app.js
  README.md
```

Tidak ada build step untuk MVP ini.
