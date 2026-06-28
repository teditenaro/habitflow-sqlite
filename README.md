# HabitFlow — Habit Tracker Lokal (SQLite)

Aplikasi habit tracker yang berjalan **100% lokal** di komputer kamu — tidak perlu MySQL, tidak perlu internet, tidak perlu setup database. Semua data tersimpan otomatis di satu file `data.db`.

---

## Fitur

- **Tambah & hapus habit** dengan nama dan warna pilihan sendiri
- **Toggle check-in** per hari — klik untuk centang, klik lagi untuk batal
- **Statistik mingguan** perbandingan bulan ini vs bulan lalu (grafik W1–W4)
- **Export CSV** untuk rentang 1 bulan hingga 1 tahun, siap dibuka di Excel / Google Sheets
- **Zero setup** — database SQLite dibuat otomatis saat pertama dijalankan
- **Ringan & cepat** — stack sederhana: Node.js + Express + better-sqlite3

---

## Prasyarat

- **Node.js ≥ 18**

Cek versi Node.js kamu:
```bash
node -v
```

---

## Instalasi & Menjalankan

```bash
# 1. Clone atau ekstrak folder proyek
cd habitflow-sqlite

# 2. Install dependensi
npm install

# 3. Jalankan server
npm start

# 4. Buka di browser
#    → http://localhost:3000
```

Selesai. File `data.db` otomatis dibuat saat pertama kali dijalankan.

---

## Konfigurasi (opsional)

Buat file `.env` di root folder untuk mengubah port atau lokasi database:

```
PORT=3000
DB_PATH=./data.db
```

Salin dari template yang sudah tersedia:
```bash
cp .env.example .env
```

| Variabel  | Default      | Keterangan                          |
|-----------|--------------|-------------------------------------|
| `PORT`    | `3000`       | Port HTTP server                    |
| `DB_PATH` | `./data.db`  | Path file database SQLite           |

---

## Penggunaan

### Menambah Habit
Klik tombol **"+ Habit Baru"** di halaman utama, masukkan nama habit dan pilih warna.

### Check-in Harian
Klik kotak pada hari yang ingin dicatat. Klik lagi untuk membatalkan. Data langsung tersimpan ke database.

### Statistik
Buka halaman **Statistik** untuk melihat grafik perbandingan aktivitas minggu per minggu antara bulan ini dan bulan lalu.

### Export Data
Buka halaman **Export CSV** di sidebar, pilih rentang tanggal (1 bulan hingga 1 tahun), lalu klik Download. File CSV akan memuat kolom untuk setiap habit dengan nilai `1` (selesai) atau `0` (tidak selesai) per tanggal.

---

## Struktur File

```
habitflow-sqlite/
├── server.js          ← Server Express: REST API + serving frontend
├── public/
│   └── index.html     ← Tampilan web (single-page app)
├── data.db            ← Database SQLite (dibuat otomatis)
├── .env.example       ← Template konfigurasi
├── package.json
└── README.md
```

---

## API Endpoints

Semua endpoint mengembalikan JSON kecuali `/api/export`.

| Method | Endpoint              | Keterangan                                             |
|--------|-----------------------|--------------------------------------------------------|
| GET    | `/api/habits`         | Ambil semua habit aktif                                |
| POST   | `/api/habits`         | Tambah habit baru (`{ name, color }`)                  |
| DELETE | `/api/habits/:id`     | Hapus habit (soft delete)                              |
| GET    | `/api/logs`           | Ambil log check-in (`?from=YYYY-MM-DD&to=YYYY-MM-DD`) |
| POST   | `/api/logs/toggle`    | Toggle check-in (`{ habit_id, date }`)                 |
| GET    | `/api/stats/monthly`  | Statistik mingguan (`?year=&month=`)                   |
| GET    | `/api/export`         | Download CSV (`?from=YYYY-MM-DD&to=YYYY-MM-DD`)        |
| GET    | `/api/health`         | Health check status server & database                  |

---

## Skema Database

**Tabel `habits`**

| Kolom        | Tipe    | Keterangan                          |
|--------------|---------|-------------------------------------|
| `id`         | TEXT PK | UUID unik                           |
| `name`       | TEXT    | Nama habit                          |
| `color`      | TEXT    | Warna hex (default `#7c6af7`)       |
| `created_at` | TEXT    | Tanggal dibuat (YYYY-MM-DD)         |
| `is_active`  | INTEGER | `1` = aktif, `0` = dihapus         |

**Tabel `logs`**

| Kolom        | Tipe       | Keterangan                          |
|--------------|------------|-------------------------------------|
| `id`         | INTEGER PK | Auto-increment                      |
| `habit_id`   | TEXT       | Referensi ke `habits.id`            |
| `log_date`   | TEXT       | Tanggal check-in (YYYY-MM-DD)       |
| `created_at` | TEXT       | Waktu pencatatan (datetime)         |

Kombinasi `(habit_id, log_date)` bersifat unik — tidak bisa double check-in di hari yang sama.

---

## Backup & Portabilitas

Semua data tersimpan dalam satu file `data.db`. Untuk backup, cukup copy file tersebut:

```bash
cp data.db data.db.backup
```

Untuk pindah ke komputer lain, bawa serta file `data.db` bersama folder proyek dan jalankan `npm start`.

---

## Troubleshooting

**Port sudah dipakai**
```
Error: listen EADDRINUSE :::3000
```
Ganti port di `.env`:
```
PORT=3001
```

**Module not found / error saat `npm install`**
Pastikan versi Node.js ≥ 18. Package `better-sqlite3` memerlukan native compilation:
```bash
node -v   # pastikan v18 ke atas
npm install
```

**Database tidak bisa dibaca**
Pastikan folder tempat `data.db` berada memiliki izin tulis. Bisa juga atur path kustom di `.env`:
```
DB_PATH=/path/yang/bisa/ditulis/data.db
```

---

## Teknologi

- [Node.js](https://nodejs.org/) — runtime
- [Express](https://expressjs.com/) — HTTP server & routing
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — SQLite driver (synchronous, cepat)
- [dotenv](https://github.com/motdotla/dotenv) — manajemen konfigurasi
