# ⚖️ Analisis Pro & Kontra Arsitektur & Aturan AI (Pros & Cons)

Dokumen ini menyediakan analisis objektif mengenai kelebihan (Pros) dan kekurangan/konsekuensi (Cons) dari pemilihan tumpukan teknologi (tech stack), segmentasi state, serta penerapan aturan sistem AI di repositori ini.

---

## 1. Penerapan Aturan Sistem AI (AI Rules Guardrails)
Penerapan berkas konfigurasi `.cursorrules`, `.windsurfrules`, atau `.github/copilot-instructions.md`.

### 🟢 Kelebihan (Pros)
*   **Konsistensi Arsitektur Mutlak**: Mencegah pengembang (maupun AI) menulis kode instan yang asal jalan tetapi menyimpang dari struktur folder `/features` atau penamaan yang disepakati.
*   **Pencegahan Kerentanan Dini**: AI dipaksa menerapkan proteksi IDOR, enkripsi hardware, data masking, dan sanitasi XSS sejak baris pertama kode ditulis.
*   **Code Review yang Lebih Cepat**: Memangkas waktu tinjauan Pull Request (PR) karena AI bertindak sebagai linter arsitektur otomatis sebelum kode sampai ke review manusia.
*   **Onboarding yang Mulus**: Anggota tim baru cukup membaca dokumen aturan ini dan membiarkan AI membantu mereka menulis kode yang sesuai standar proyek secara instan.

### 🔴 Kekurangan / Konsekuensi (Cons)
*   **Overhead Pemeliharaan**: Dokumen aturan ini harus selalu diperbarui secara manual jika ada perubahan teknologi utama agar AI tidak menyarankan kode usang (*deprecated*).
*   **Konsumsi Token Lebih Tinggi**: Menyuntikkan instruksi panjang ke dalam *context window* AI meningkatkan penggunaan token (dan biaya/kuota) serta berpotensi meningkatkan latensi respons.
*   **Batasan Kreativitas Kode**: Pengembang berpengalaman mungkin merasa terbatasi jika ingin mencoba pola arsitektur baru yang tidak tercakup dalam aturan saat ini.

---

## 2. Backend: NestJS & Prisma ORM

### 🟢 Kelebihan (Pros)
*   **Arsitektur Berbasis Opini (Opinionated)**: Struktur modular NestJS (Module, Controller, Service) memastikan kode backend tetap terorganisir dengan baik seiring pertumbuhan proyek.
*   **Dependency Injection Terintegrasi**: Memudahkan unit testing karena dependensi dapat di-mock dengan sangat mudah.
*   **Type-Safety Ujung ke Ujung**: Skema Prisma secara otomatis menghasilkan tipe TypeScript yang sinkron dengan database, meminimalkan bug tipe data.
*   **Migrasi yang Jelas**: Prisma Migrate melacak perubahan skema melalui SQL migrasi yang mudah dibaca dan di-commit ke Git.

### 🔴 Kekurangan / Konsekuensi (Cons)
*   **Kurva Pembelajaran Curam**: Developer yang terbiasa dengan Express.js minimalis memerlukan waktu untuk memahami konsep Decorator, Providers, Modules, dan Request Lifecycle NestJS.
*   **Overhead Kinerja Cold-Start**: Prisma menggunakan engine biner (Rust-based helper) yang dapat meningkatkan waktu cold-start di lingkungan serverless (seperti Vercel/AWS Lambda).
*   **Kueri Kompleks yang Sulit di-Optimasi**: Operasi database yang sangat kompleks (seperti rekursif, window functions, atau pelaporan data besar) sering kali sulit ditulis di Prisma dan membutuhkan transisi ke raw SQL (`$queryRaw`).

---

## 3. Frontend Web: Next.js App Router (RSC vs RCC)

### 🟢 Kelebihan (Pros)
*   **React Server Components (RSC) secara Default**: Mengurangi ukuran bundle JavaScript di sisi klien secara signifikan karena sebagian besar rendering dan pengambilan data terjadi di server.
*   **Optimasi SEO Bawaan**: Dukungan meta-tag dinamis dan rendering server penuh memudahkan perayap mesin pencari (SEO bots) mengindeks situs.
*   **Kecepatan LCP (Largest Contentful Paint)**: Data diambil langsung dari server yang dekat dengan database, mengurangi rantai request API klien.
*   **Routing Berbasis Berkas (File-based Routing)**: Mempermudah pemisahan rute, penanganan transisi (`loading.tsx`), serta isolasi error (`error.tsx`).

### 🔴 Kekurangan / Konsekuensi (Cons)
*   **Kompleksitas Hydration & SSR**: Sering terjadi error ketidakcocokan *hydration* jika data klien (seperti zona waktu atau status persisten) dirender di server tanpa penanganan khusus.
*   **Batas Mental yang Membingungkan**: Developer harus selalu sadar di mana kode berjalan (apakah di Server dengan `"use server"` atau di Klien dengan `"use client"`), yang sering kali menyebabkan kebingungan pengiriman event handler atau context.
*   **Caching Agresif**: Next.js secara default memiliki kebijakan caching yang sangat agresif. Salah konfigurasi revalidasi dapat menyebabkan pengguna melihat data usang.

---

## 4. Segmentasi State: TanStack Query + Zustand + useState

### 🟢 Kelebihan (Pros)
*   **Pemisahan Tanggung Jawab yang Jelas**:
    *   **TanStack Query** mengelola *Server State* (caching, sinkronisasi, refetch otomatis, loading/error state gratis).
    *   **Zustand** mengelola *Global Client State* (auth, tema, preferensi pengguna) tanpa boilerplate berat seperti Redux.
    *   **useState** mengelola *Local UI State* (buka/tutup modal, status input aktif) yang terisolasi di komponen terkait.
*   **Kinerja Rerender Optimal**: Zustand menggunakan penyeleksi state (*selectors*) untuk memastikan hanya komponen yang memantau nilai tertentu yang dirender ulang.
*   **Pengalaman Pengguna Lebih Baik**: TanStack Query mendukung *optimistic updates* (mengubah UI terlebih dahulu sebelum respons server selesai) sehingga aplikasi terasa sangat responsif.

### 🔴 Kekurangan / Konsekuensi (Cons)
*   **Kompleksitas Sinkronisasi**: Jika tidak hati-hati, state global di Zustand bisa bertabrakan atau tidak sinkron dengan server state di TanStack Query (misalnya status keranjang belanja).
*   **Kurva Belajar Kunci Query (Query Keys)**: Manajemen *cache invalidation* di TanStack Query memerlukan pemahaman mendalam tentang siklus hidup query key untuk menghindari bug data tidak terbarui.
*   **Pilihan Gaya Bebas di Zustand**: Zustand tidak memaksakan struktur berkas tertentu (seperti Redux Toolkit), sehingga struktur store dapat menjadi berantakan jika pengembang tidak mengikuti aturan penulisan yang ketat.

---

## 5. Styling: Vanilla CSS

### 🟢 Kelebihan (Pros)
*   **Kebebasan Desain Total**: Tidak terbatas oleh batasan utilitas framework (seperti Tailwind) atau overhead runtime pustaka CSS-in-JS.
*   **Nol Ukuran Bundle Parser**: Browser mengurai file CSS murni jauh lebih cepat daripada memproses framework atau parsing JS yang menghasilkan style dinamis.
*   **Pemanfaatan Fitur CSS Modern**: Mendukung penuh CSS Variables, Nesting asli, Container Queries, dan `:has()` selector tanpa perlu konfigurasi compiler tambahan.
*   **Kebersihan Markup HTML/JSX**: Mencegah penumpukan kelas utilitas yang sangat panjang pada tag JSX, menjaga struktur markup tetap mudah dibaca.

### 🔴 Kekurangan / Konsekuensi (Cons)
*   **Risiko Kebocoran Gaya (Global Scope)**: Jika tidak menggunakan CSS Modules (`*.module.css`), penulisan kelas CSS biasa berisiko menimpa gaya elemen di halaman lain.
*   **Waktu Pembuatan Lebih Lambat**: Pengembang harus menulis aturan CSS secara manual untuk setiap komponen, termasuk media queries untuk responsivitas, yang memakan waktu lebih lama dibanding mengetik utilitas kelas langsung.
*   **Inkonsistensi Skema Warna**: Tanpa sistem desain yang ketat, pengembang bisa dengan mudah memasukkan nilai warna atau padding acak (*ad-hoc*) di luar variabel tema global.

---

## 6. Mobile: React Native & Expo

### 🟢 Kelebihan (Pros)
*   **Satu Basis Kode untuk Dua Platform**: Menulis satu kode JavaScript/TypeScript untuk menghasilkan aplikasi asli iOS dan Android.
*   **Ekosistem Expo yang Kuat**: Expo SDK menyediakan pustaka siap pakai untuk fungsionalitas native (Kamera, Lokasi, Secure Store, Notifikasi) tanpa perlu konfigurasi native project manual.
*   **Pembaruan Over-the-Air (OTA)**: Menggunakan EAS Update untuk memperbaiki bug langsung ke perangkat pengguna tanpa harus menunggu proses persetujuan App Store / Play Store.

### 🔴 Kekurangan / Konsekuensi (Cons)
*   **Performa pada Operasi Berat**: Untuk aplikasi yang membutuhkan rendering 3D, pemrosesan audio/video real-time yang intens, atau animasi kompleks, React Native masih kalah cepat dibandingkan bahasa native asli (Swift/Kotlin).
*   **Ketergantungan pada Bridge / New Architecture**: Komunikasi antara JavaScript dan modul native masih membutuhkan bridge (meskipun Fabric/TurboModules di New Architecture sedang menyelesaikannya), yang bisa menjadi bottleneck performa.
*   **Masalah Pemutakhiran Versi (Upgrade)**: Melakukan upgrade versi React Native atau Expo sering kali memicu konflik package pihak ketiga dan membutuhkan debugging mendalam.
