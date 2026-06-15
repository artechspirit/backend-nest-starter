# AI Rules: General & Core Philosophy

Dokumen ini berisi pedoman koding umum, standar kualitas, keamanan, dan aturan interaksi AI yang berlaku untuk seluruh lingkungan pengembangan (baik Frontend maupun Backend). Setiap kode yang ditulis oleh pengembang maupun AI harus mematuhi aturan dasar ini.

---

## ⚡ TL;DR — Aturan Wajib (Quick Reference untuk AI)

> Baca bagian ini terlebih dahulu. Ini adalah aturan paling kritis yang TIDAK BOLEH dilanggar.

1. **DILARANG** menulis `any` dalam TypeScript — gunakan `unknown` + type narrowing.
2. **DILARANG** melakukan hardcode API Key, Password, atau Secret ke dalam kode — gunakan `.env`.
3. **DILARANG** mencatat data sensitif (password, token, PII) ke dalam log sistem.
4. **DILARANG** menulis kode dengan placeholder `// TODO: implement` — tulis implementasi lengkap.
5. **DILARANG** menginstal library eksternal untuk logika yang bisa ditulis dalam < 30 baris kode.
6. **DILARANG** membuat abstraksi bersama sebelum duplikasi kode terjadi minimal 2–3 kali.
7. **WAJIB** memvalidasi semua environment variables menggunakan Zod saat startup (fail-fast).
8. **WAJIB** menginisialisasi proyek baru menggunakan CLI resmi (create-next-app, @nestjs/cli, create-expo-app).
9. **WAJIB** menggunakan shared package (`@shared/contracts`) untuk tipe data API di monorepo.
10. **WAJIB** menggunakan Path Aliases (`@/`) — dilarang relative path panjang (`../../../../`).
11. **WAJIB** menulis cleanup function untuk setiap timer, event listener, atau stream yang dibuat.
12. **WAJIB** menggunakan format Conventional Commits untuk setiap pesan commit.
13. Format error API harus seragam: `{ success, data, error: { code, message, details } }`.
14. Gunakan Domain Error Codes (`AUTH_EMAIL_EXISTS`) bukan hanya HTTP status code.
15. Jalankan `lint:fix` sebelum commit — wajib ada konfigurasi `.eslintrc` dan `.prettierrc`.
16. **DILARANG** melakukan commit file biner besar (>10MB) langsung ke Git — wajib gunakan Git LFS atau Object Storage untuk menjaga kecepatan kloning repositori.
17. **WAJIB** menggunakan Multi-Stage Build dan mengoptimalkan susunan instruksi (layer caching) di Dockerfile untuk mempercepat deployment.
18. **WAJIB** menerapkan Trunk-Based Development dengan feature branch berumur pendek dan tag rilis berbasis Semantic Versioning (`vX.Y.Z`).
19. **WAJIB** menargetkan minimal 80% test coverage untuk logika bisnis inti (Core Services/Helpers).

---

## 1. Core Programming Principles

*   **AHA (Avoid Hasty Abstractions) > DRY (Don't Repeat Yourself)**:
    *   Jangan terburu-buru membuat utility, hook, atau service bersama. 
    *   Toleransi duplikasi hingga 2-3 kali sebelum melakukan abstraksi. Abstraksi yang salah (premature abstraction) jauh lebih mahal biayanya dibanding duplikasi kode sederhana.
*   **KISS (Keep It Simple, Stupid)**:
    *   Kode harus mudah dibaca dan dipahami dalam waktu kurang dari 1 menit oleh developer lain.
    *   Hindari trik sintaksis satu baris yang kompleks (*clever code*) jika ada cara menulis yang lebih ekspresif dan terstruktur.
*   **YAGNI (You Aren't Gonna Need It)**:
    *   Tulis kode hanya untuk kebutuhan fitur saat ini. Jangan menambahkan fungsionalitas, parameter, atau fleksibilitas ekstra untuk kebutuhan "masa depan" yang belum pasti.
*   **SOLID Principles**:
    *   **Single Responsibility Principle (SRP)**: Setiap fungsi, class, modul, atau file hanya boleh memiliki satu tanggung jawab spesifik.
    *   **Open/Closed Principle (OCP)**: Kode harus terbuka untuk diperluas (extended) namun tertutup untuk dimodifikasi secara langsung.
    *   **Dependency Inversion Principle (DIP)**: Bergantunglah pada abstraksi (interface/type), bukan pada implementasi konkret.

---

## 2. TypeScript, Monorepo & Imports Standards

*   **Zero Implicit/Explicit Any**:
    *   Penggunaan tipe `any` sangat dilarang.
    *   Gunakan `unknown` jika tipe data dinamis/tidak diketahui di awal, lalu lakukan *type narrowing* (`typeof`, `instanceof`, custom *type guards*).
*   **Type Safety over Casting**:
    *   Hindari penggunaan type assertion (`as Type`) kecuali terpaksa (misal: saat mem-parsing library pihak ketiga yang kurang ter-type). Gunakan validasi runtime (Zod) untuk menjamin keaslian tipe data.
*   **Shared Contracts (Monorepo Best Practice)**:
    *   Jika aplikasi dibagi menjadi Frontend (Next.js), Mobile (React Native), dan Backend (NestJS), tipe data API (Request/Response DTO) dan skema validasi (Zod) harus disimpan di dalam shared package (misal: `@shared/contracts` atau `@shared/types`).
    *   Hindari mendeklarasikan ulang (duplicate) interface API di frontend jika backend sudah menyediakannya.
*   **Imports & Path Aliasing**:
    *   Gunakan Path Aliases (misal: `@/components/...` atau `@shared/...`) untuk menghindari relative path panjang yang membingungkan (`../../../../components/...`).
    *   Hindari import wildcard (`import * as ...`) guna mendukung optimasi *tree-shaking* yang maksimal pada bundler.

---

## 3. Environment & Dependency Management

*   **Fail-Fast Environment Validation**:
    *   Semua environment variables (`process.env`) wajib divalidasi menggunakan Zod schema saat aplikasi booting (startup phase).
    *   Jika terdapat env yang tidak lengkap atau memiliki format yang salah, aplikasi harus sengaja gagal booting (crash early) dengan pesan error yang jelas dan detail di sisi console/log.
*   **Strict Dependency Management**:
    *   Jangan pernah menginstal library eksternal untuk masalah sepele (seperti formatting string sederhana atau manipulasi array ringan). Wajib menulis logika kustom jika solusinya kurang dari 30 baris kode.
    *   Sebelum menambahkan package baru, verifikasi:
        1.  **Ukuran bundle**: Gunakan Bundlephobia (prioritaskan package berukuran kecil dan tree-shaking friendly).
        2.  **Lisensi**: Pastikan lisensi package ramah komersial (seperti MIT, Apache 2.0, BSD). Hindari lisensi GPL/AGPL.
        3.  **Duplikasi fitur**: Pastikan tidak ada package serupa yang sudah terpasang (misal: jangan memakai Axios jika Fetch API sudah cukup, atau menggunakan Lodash jika Native ES6 sudah memadai).

---

## 4. Resource Management & Memory Cleanup

*   **Pencegahan Memory Leaks**:
    *   Setiap kali menginisialisasi resource yang berjalan terus-menerus (*persistent resources*), wajib menulis fungsi pembersih (*cleanup*) saat resource tersebut tidak lagi digunakan atau saat komponen/app dihancurkan (unmount/destroy).
*   **Aplikasi Frontend & Mobile**:
    *   Wajib menghapus timers (`clearTimeout`, `clearInterval`) di dalam blok cleanup `useEffect` atau saat komponen di-unmount.
    *   Wajib menghapus *event listeners* global (`window.addEventListener`, `BackHandler.addEventListener` di React Native) untuk menghindari penumpukan listener.
*   **Aplikasi Backend**:
    *   Wajib menutup koneksi database pool secara rapi saat proses shutdown atau saat modul dihancurkan (manfaatkan lifecycle hook NestJS seperti `onModuleDestroy` atau `beforeApplicationShutdown`).
    *   Wajib menutup koneksi stream (`fs.ReadStream`, file descriptor, socket connection) setelah operasi I/O selesai.

---

## 5. Universal Error & Response Format

*   **Domain Error Codes**:
    *   Jangan mengandalkan HTTP Status Code saja untuk mengidentifikasi jenis error pada client side.
    *   Gunakan kode error domain terstandarisasi yang dikirim di dalam body response (contoh: `AUTH_EMAIL_ALREADY_EXISTS`, `PAYMENT_INSUFFICIENT_FUNDS`, `VALIDATION_FAILED`).
*   **Standardized API Response**:
    *   Semua API response harus mengikuti format struktur pembungkus (wrapper) yang seragam:
        ```typescript
        interface ApiResponse<T> {
          success: boolean;
          data: T | null;
          error: {
            code: string;       // Domain-specific error code
            message: string;    // Human-readable message
            details?: any;      // Validasi DTO error detail (jika ada)
          } | null;
        }
        ```

---

## 6. Security & Sensitive Data

*   **Zero-Trust Input**:
    *   Jangan pernah mempercayai data yang dikirim oleh pengguna, klien, atau API pihak ketiga. Validasi seluruh input secara ketat menggunakan Zod sebelum diproses oleh logika bisnis.
*   **Secrets Management**:
    *   Dilarang keras melakukan hardcode kredensial sensitif (API Key, Token, DB Password) di dalam repositori. Gunakan environment variables dan pastikan file `.env` terdaftar di `.gitignore`.
*   **Logging Sanitization**:
    *   Jangan pernah mencatat informasi sensitif (password, nomor kartu kredit, token JWT, PII/Personally Identifiable Information) ke dalam log sistem (Sentry, console, file log). Sensor (mask) data sensitif tersebut sebelum dicatat.

---

## 7. Git, Linting & Collaboration Workflow

*   **ESLint & Prettier (Formatting Rules)**:
    *   Setiap repositori wajib memiliki file konfigurasi ESLint (`.eslintrc`) dan Prettier (`.prettierrc`) yang disepakati bersama.
    *   Developer dan AI wajib menjalankan perintah lint auto-fix (`npm run lint:fix` atau `pnpm lint --fix`) sebelum membuat Pull Request atau melakukan commit untuk menghindari perdebatan format (formatting wars) pada histori Git.
*   **Conventional Commits**:
    *   Format commit message wajib mengikuti: `<type>(<scope>): <description>`
    *   Tipe commit yang diizinkan:
        *   `feat`: Menambahkan fitur baru.
        *   `fix`: Memperbaiki bug.
        *   `refactor`: Mengubah kode tanpa merubah fungsionalitas.
        *   `docs`: Perubahan pada dokumentasi.
        *   `style`: Formatting kode (spasi, semi-colon, tanpa merubah logika).
        *   `test`: Menambahkan atau memodifikasi file pengujian.
        *   `chore`: Update dependencies, konfigurasi CI/CD, build tools.
*   **Self-Documenting Code**:
    *   Tulis kode yang deskriptif sehingga tidak memerlukan komentar untuk menjelaskan *apa* yang dilakukan kode tersebut.
    *   Gunakan komentar hanya untuk menjelaskan *mengapa* (why) suatu keputusan arsitektur atau logika rumit diambil (misal: integrasi bug workaround library eksternal).
*   **Git Performance & Binary Mitigation**:
    *   **Dilarang keras** melakukan commit file biner besar (>10MB) seperti video demo, zip archive, package tarball, database dump, atau raw image asset langsung ke repositori Git. Hal ini akan membengkakkan ukuran repositori selamanya dan memperlambat waktu cloning di pipeline CI/CD serta mesin developer lokal.
    *   **Wajib** menggunakan **Git LFS (Large File Storage)** jika file biner harus disimpan di dalam repositori, atau lebih direkomendasikan mengunggahnya ke Object Storage (S3/R2/GCS) dan mereferensikan URL-nya di dalam file markdown/code.
*   **Git Branching & Release Strategy (Trunk-Based Development)**:
    *   **Trunk-Based Workflow**: Gunakan pendekatan *Trunk-Based Development* di mana developer membuat branch berumur pendek (*short-lived feature branches*) dari `main` dan sering melakukan merge kembali ke `main` (misal: harian) setelah lulus PR review dan test otomatis.
    *   **Konvensi Penamaan Branch**: Branch fitur wajib menggunakan format: `feat/fitur-baru`, perbaikan bug: `fix/nama-bug`, pemeliharaan: `chore/setup-config`.
    *   **Versioning**: Rilis resmi wajib ditandai menggunakan Git Tag dengan format **Semantic Versioning** (`vX.Y.Z` contoh: `v1.0.3` di mana X=Major, Y=Minor, Z=Patch).
*   **Media/Asset Optimization**:
    *   **Dilarang** menyertakan berkas gambar atau video mentah (tanpa kompresi) ke dalam folder aset lokal.
    *   **Vektor (SVG)**: Wajib dibersihkan menggunakan **SVGO** (atau CLI web SVGOMG) untuk membuang metadata XML editor yang tidak berguna sebelum dimasukkan ke kode.
    *   **Animasi & Lottie**: Gunakan file Lottie JSON yang sudah dikompresi, atau lebih direkomendasikan menggunakan format video `.webm`/`.mp4` dengan resolusi terbatas untuk animasi latar belakang yang panjang guna menghemat runtime RAM.

---

## 8. Containerization & CI/CD Pipeline Performance

### A. Docker Multi-Stage Build & Layer Caching
*   **Wajib Multi-Stage Build**: Untuk deployment menggunakan Docker, wajib mengimplementasikan pola *Multi-Stage Build* guna memisahkan lingkungan build (development dependencies + compile tools) dari lingkungan production runtime.
    *   Image produksi akhir **wajib** berukuran seminimal mungkin (menggunakan base image ramping seperti Alpine Linux atau Distroless), dengan target ukuran di bawah **150MB - 300MB**.
*   **Layer Caching Optimization**: Susun instruksi Dockerfile agar memaksimalkan pemanfaatan caching layer Docker:
    *   ✔️ **Benar**: Salin berkas package manager (`package.json`, `pnpm-lock.yaml`) dan jalankan install dependensi terlebih dahulu, baru kemudian salin sisa file kode sumber. Ini mencegah penginstalan ulang dependensi dari nol setiap kali ada perubahan baris kode biasa.

### B. CI/CD Pipeline Acceleration
*   **Dependency Caching**: Setiap berkas workflow CI/CD (GitHub Actions, GitLab CI/CD, dsb.) **wajib** mengonfigurasi cache untuk folder dependensi (`node_modules` or global store pnpm/yarn/npm). Ini dapat mempercepat waktu eksekusi pipeline hingga 60-80%.
*   **Parallel Execution**: Jalankan langkah testing, linting, dan build secara paralel jika didukung oleh runner, serta manfaatkan sharding untuk unit/E2E test yang memakan waktu lama guna mempercepat feedback loop developer.

---

## 9. Testing & Quality Assurance Standards

### A. Piramida Testing & Target Cakupan (Coverage)
*   **Target Unit Test (Core Logic)**: Kode yang memproses logika bisnis penting (seperti kalkulasi harga, validasi token, helper transform) **wajib** memiliki unit test dengan coverage minimal **80%**.
*   **Dilarang Test Redundan**: Jangan menulis unit test untuk UI yang sering berubah (seperti file css, tombol yang tidak memiliki logika, atau static components) kecuali untuk memverifikasi fungsionalitas kritis.
*   **Integration & E2E Testing**:
    *   Rute transaksi dan alur bisnis utama (Login, Register, Checkout, Payment) **wajib** dilindungi oleh E2E / Integration tests (Playwright untuk Web, Detox/Appium untuk Mobile).

### B. Strategi Mocking
*   **Unit Test Isolasi**: Unit test harus 100% independen. Semua koneksi jaringan (fetch API), I/O database, dan internal timer wajib di-mock secara lengkap.
*   **Integration Test Realitas**: Integration test diperbolehkan menembak database dummy (database testing terisolasi yang di-reset sebelum test berjalan), tetapi dilarang menembak API pihak ketiga secara live (wajib menggunakan API Mocking seperti MSW - Mock Service Worker).

---

## 10. Aturan Interaksi AI (AI Agent Constraints)

Saat AI memproses atau merekomendasikan kode untuk proyek ini, AI wajib mematuhi aturan berikut:

1.  **Dilarang Menulis Placeholder**: Jangan pernah memotong kode dengan komentar `// TODO`, `// ... rest of the code`, atau sejenisnya. Tulis seluruh kode secara lengkap dan siap dijalankan.
2.  **Verifikasi Sebelum Implementasi**: Selalu cek apakah utilitas atau helper serupa sudah ada di repositori sebelum membuat fungsi baru untuk mencegah duplikasi kode.
3.  **Tulis Automated Tests**: Setiap membuat utilitas baru atau fungsi logika bisnis, sertakan file unit test pendamping menggunakan framework pengujian terpasang (Vitest/Jest).
4.  **Penanganan Skenario Gagal**: Jangan hanya memikirkan "happy path". AI wajib merancang penanganan error yang elegan saat API mati, format data salah, atau koneksi terputus.
5.  **Aksesibilitas (a11y)**: Pastikan elemen UI HTML/React menggunakan tag semantik yang tepat, ramah SEO, dan mematuhi WCAG 2.1 minimal level AA.
6.  **Inisialisasi Proyek Wajib Menggunakan CLI Resmi**:
    *   Jika diminta untuk menginisialisasi atau mengatur (setup) proyek baru (NestJS, Next.js, atau React Native/Expo), AI **dilarang keras** membuat berkas konfigurasi (`package.json`, `tsconfig.json`, `eslint`, dll.) secara manual dari nol.
    *   AI **wajib** menggunakan CLI resmi dengan parameter non-interaktif (`-y` atau opsi default):
        *   **Next.js**: `npx -y create-next-app@latest <nama-project> --typescript --tailwind --app --src-dir --import-alias "@/*"`
        *   **NestJS**: `npx -y @nestjs/cli new <nama-project> --package-manager pnpm` (sesuaikan package manager yang digunakan)
        *   **React Native (Expo)**: `npx -y create-expo-app@latest <nama-project> --template blank-typescript`
