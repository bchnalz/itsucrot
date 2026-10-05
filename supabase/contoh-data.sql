-- Opsional: 6 postingan CONTOH supaya halaman tidak kosong saat pertama dicoba.
-- Semua bertag "contoh". Hapus kapan saja dari panel admin, atau jalankan:
--   delete from public.posts where 'contoh' = any(tags);

insert into public.posts (title, kind, category, tags, summary, content, links, views) values
(
  'Printer tidak terdeteksi setelah update Windows',
  'solusi', 'Printer', array['printer','driver','windows update','contoh'],
  'Hapus driver lama, restart Print Spooler, lalu pasang ulang driver dari situs vendor.',
  E'Gejala: printer muncul "Offline" atau hilang dari daftar setelah Windows Update.\n\n1. Buka services.msc, cari Print Spooler, klik Restart.\n2. Buka Settings > Bluetooth & devices > Printers, hapus printer yang bermasalah.\n3. Jalankan printui /s /t2, hapus paket driver lama.\n4. Pasang driver terbaru dari link di bawah, lalu tambahkan printer lagi.\n\nCatatan: untuk printer jaringan, pastikan IP printer bisa di-ping dulu.',
  '[{"label":"Driver HP (support.hp.com)","url":"https://support.hp.com/drivers"},{"label":"Driver Epson","url":"https://epson.com/Support/sl/s"}]',
  42
),
(
  'Installer Google Chrome offline (MSI untuk semua user)',
  'software', 'Browser', array['chrome','installer','msi','contoh'],
  'Paket MSI Chrome Enterprise untuk instal tanpa internet atau lewat deployment.',
  E'Gunakan versi 64-bit kecuali PC masih 32-bit.\n\nInstal diam-diam:\n`msiexec /i GoogleChromeStandaloneEnterprise64.msi /qn`',
  '[{"label":"Chrome Enterprise (MSI)","url":"https://chromeenterprise.google/browser/download/"}]',
  31
),
(
  'Outlook terus meminta password',
  'solusi', 'Email & Akun', array['outlook','password','credential','contoh'],
  'Hapus kredensial lama di Credential Manager lalu buat ulang profil Outlook.',
  E'1. Tutup Outlook.\n2. Control Panel > Credential Manager > Windows Credentials.\n3. Hapus semua entri yang mengandung "MicrosoftOffice" atau "outlook".\n4. Buka Outlook dan login ulang.\n5. Jika masih berulang: Control Panel > Mail > Show Profiles > Add, buat profil baru.',
  '[{"label":"Panduan Microsoft","url":"https://support.microsoft.com/outlook"}]',
  27
),
(
  'AnyDesk portable untuk remote user',
  'software', 'Remote', array['anydesk','remote','contoh'],
  'Tidak perlu instal, cukup jalankan dan minta ID dari user.',
  E'Minta user membuka link, jalankan AnyDesk.exe, lalu bacakan 9 digit ID-nya.',
  '[{"label":"Unduh AnyDesk","url":"https://anydesk.com/en/downloads/windows"}]',
  19
),
(
  'Wi-Fi tersambung tapi tidak ada internet',
  'solusi', 'Jaringan', array['wifi','dns','ip','contoh'],
  'Reset stack jaringan dan cek DNS.',
  E'Jalankan di Command Prompt (Run as administrator):\n\n- `ipconfig /release`\n- `ipconfig /renew`\n- `ipconfig /flushdns`\n- `netsh winsock reset`\n\nRestart PC. Jika masih gagal, coba ping 8.8.8.8. Kalau ping berhasil tapi situs tidak terbuka, masalahnya di DNS.',
  '[]',
  12
),
(
  'Checklist serah terima laptop baru',
  'panduan', 'Hardware', array['laptop','onboarding','checklist','contoh'],
  'Urutan pengecekan sebelum laptop diserahkan ke user.',
  E'1. Cek fisik dan nomor aset sesuai form.\n2. Login dengan akun domain user.\n3. Pastikan antivirus aktif dan ter-update.\n4. Instal aplikasi standar.\n5. Tes printer, Wi-Fi kantor, dan VPN.\n6. Minta tanda tangan user di form serah terima.',
  '[]',
  8
);
