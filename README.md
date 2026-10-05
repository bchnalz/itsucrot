# Pusat Solusi IT

Website knowledge base untuk petugas End User Support. Petugas membuka situs **tanpa login**, mengetik kata kunci, lalu langsung mendapat link solusi masalah, installer software, atau panduan. Satu admin login untuk menambah, mengubah, dan menghapus postingan.

**Fitur**

- Pencarian instan (judul, ringkasan, tag, isi, link, dan kode `KB-0001`), hasil disorot.
- **Paling sering dilihat** (peringkat berdasarkan jumlah tayangan) dan **Terbaru** di halaman depan.
- Filter jenis (Solusi / Software / Panduan) dan kategori.
- Tombol link cepat langsung di hasil pencarian, tombol **Salin link** untuk dikirim ke user lewat WhatsApp.
- Setiap postingan punya nomor `KB-xxxx` yang mudah disebut antar petugas.
- Ramah ponsel, mode gelap otomatis, data halaman depan tersimpan di perangkat sehingga tetap tampil saat sinyal lemah.
- Tayangan dihitung satu kali per perangkat setiap 6 jam, jadi peringkat tidak naik karena halaman dimuat ulang.

**Teknologi**: HTML + JavaScript biasa (tanpa build), di-hosting di **Vercel**, data dan login admin di **Supabase** (paket gratis cukup).

---

## Cara pasang

Kredensial **tidak** ditulis di kode. Semuanya diambil dari GitHub repository secrets
(**Settings > Secrets and variables > Actions**):

| Secret | Isi | Dipakai untuk |
|---|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` | situs & pemasangan skema |
| `SUPABASE_ANON_KEY` | anon / publishable key | situs (aman dibaca browser) |
| `SUPABASE_ACCESS_TOKEN` | personal access token Supabase | memasang skema otomatis |

Secret / service_role key **tidak dipakai** dan tidak boleh dimasukkan ke situs; build akan menolak jika key itu yang terpasang.

### 1. Skema database (otomatis)
Setiap push ke `main`, GitHub Actions (`.github/workflows/deploy.yml`) menjalankan `supabase/schema.sql` ke project Supabase. Skema aman dijalankan berulang.

### 2. Akun admin
1. Supabase > **Authentication > Users > Add user > Create new user**. Isi email & password admin, centang *Auto Confirm User*.
2. Supabase > **Authentication > Sign In / Providers**: matikan **Allow new users to sign up**.
3. GitHub > **Actions > Database & Deploy > Run workflow**, isi **admin_email** dengan email tadi. Centang **seed_examples** jika ingin 6 postingan contoh (bertag `contoh`, bisa dihapus).

Jika langkah 3 terlewat, halaman `/admin` menampilkan perintah SQL yang tinggal disalin ke Supabase SQL Editor.

### 3. Deploy ke Vercel (pilih salah satu)
**A. Integrasi Git Vercel (paling mudah)**
1. https://vercel.com > **Add New > Project** > pilih repo ini. Pengaturan build sudah ada di `vercel.json`.
2. Di **Settings > Environment Variables** Vercel, tambahkan `SUPABASE_URL` dan `SUPABASE_ANON_KEY` (nilai sama dengan secret GitHub). Vercel tidak bisa membaca secret GitHub, jadi dua nilai ini perlu disalin sekali.
3. Deploy. Setiap push berikutnya ter-deploy otomatis.

**B. Deploy dari GitHub Actions** (memakai secret GitHub langsung)
Tambahkan secret `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Workflow akan build dan deploy sendiri. Jika memakai cara B, putuskan integrasi Git di Vercel agar tidak deploy dua kali.

Bagikan alamatnya (mis. `https://nama-project.vercel.app`) ke petugas dan sarankan disimpan ke layar utama ponsel (*Add to Home screen*). Nama situs bisa diubah lewat env `SITE_NAME` dan `SITE_TAGLINE`.

Halaman admin: `https://alamat-anda/admin`

---

## Menulis postingan yang mudah dicari
- **Judul** = gejala atau nama software, seperti yang diketik petugas: "Outlook terus minta password".
- **Ringkasan** = satu kalimat inti solusi, tampil di hasil pencarian.
- **Tag** = sinonim dan istilah lain: `outlook, password, credential, minta login`.
- **Link pertama** tampil sebagai tombol cepat di hasil pencarian, jadi taruh link terpenting di urutan pertama.
- Perintah CMD/PowerShell, path, atau IP taruh di kolom **Perintah / kode siap salin**: petugas cukup mengetuk tombol Salin.
- Isi mendukung format sederhana: baris `1.` jadi daftar bernomor, `-` jadi poin, `` `perintah` `` jadi kode yang bisa diketuk untuk disalin, teks di antara baris ``` jadi kotak kode dengan tombol Salin, URL otomatis jadi link.
- Hapus centang **Terbitkan** untuk menyimpan sebagai draf.

## Struktur file
```
index.html          halaman depan (cari, populer, terbaru)
post.html           halaman detail postingan
admin.html          panel admin
config.js           pengaturan untuk uji lokal (saat deploy dibuat ulang dari secrets)
scripts/build.mjs   build ke dist/ + membuat config.js dari env
.github/workflows/deploy.yml  pasang skema & deploy
assets/app.css      tampilan
assets/common.js    fungsi bersama
assets/public.js    logika halaman depan
assets/admin.js     logika panel admin
supabase/schema.sql tabel, aturan keamanan, fungsi pencarian & tayangan
supabase/contoh-data.sql  data contoh (opsional)
vercel.json         pengaturan Vercel (URL tanpa .html, header keamanan)
```

## Uji di komputer sendiri
```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/build.mjs
npx serve dist
```
lalu buka alamat yang ditampilkan.
