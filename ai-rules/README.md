# AI Rules Repository

Selamat datang di repositori panduan **AI Rules** untuk standardisasi pengembangan aplikasi yang aman (*secure*), cepat (*performant*), terstruktur (*scalable*), dan mudah dipelihara (*maintainable*).

Aturan-aturan ini dirancang untuk diintegrasikan ke dalam repositori proyek Anda agar dapat langsung dipahami oleh pengembang manusia serta dibaca oleh **AI Coding Assistants** (seperti Cursor, Windsurf, Copilot, Gemini Code Assist, dll.) guna mencegah degradasi kualitas kode.

---

## 🗂️ Panduan Aturan

Repositori ini dibagi secara modular sesuai dengan perannya:

1.  **[General Rules & Core Philosophy](file:///home/beta/workspace/starter-kit/ai-rules/general-rules.md)**:
    Pedoman pemrograman umum (KISS, YAGNI, SOLID), standar tipe data TypeScript, manajemen dependensi, penanganan memory leak, data masking PII, standar Conventional Commits, dan batasan perilaku AI.
2.  **[Backend Rules (NestJS & Prisma)](file:///home/beta/workspace/starter-kit/ai-rules/backend-rules.md)**:
    Panduan arsitektur modular NestJS, dependency injection, validasi DTO ketat, keamanan token (Access/Refresh), proteksi IDOR, logging JSON terstruktur, transaksi database, dan migrasi zero-downtime (*Expand & Contract*).
3.  **[Frontend Next.js Rules](file:///home/beta/workspace/starter-kit/ai-rules/frontend-nextjs-rules.md)**:
    Best practices Next.js App Router (RSC vs RCC), optimasi Core Web Vitals (LCP/CLS/INP), standardisasi state (Zustand vs TanStack vs useState vs URL), validasi Form (Hook Form + Zod), i18n, CSP, proteksi rute, dan error boundaries.
4.  **[Frontend React Native & Expo Rules](file:///home/beta/workspace/starter-kit/ai-rules/frontend-reactnative-rules.md)**:
    Best practices mobile rendering (`@shopify/flash-list`), penanganan keyboard overlap & AppState lifecycle, native-hardware permissions safety, secure storage (Keychain/SecureStore), SSL Pinning, deep link safety, dan tapjacking protection.
5.  **[Testing & Quality Assurance Rules](file:///home/beta/workspace/starter-kit/ai-rules/testing-rules.md)**:
    Standar pengujian (Unit, Integration, E2E, UI/Component), metodologi API & DB Mocking (MSW & DB Sandbox), otomatisasi dengan Husky/lint-staged, target cakupan pengujian (minimum 80% coverage), dan batasan penulisan tes bagi AI.

---

## 🚀 Tutorial Pemakaian & Integrasi

Berikut adalah panduan lengkap cara mengaktifkan aturan-aturan ini agar dipatuhi secara otomatis oleh AI Coding Assistant di workspace Anda.

### Skenario 1: Menggunakan Cursor (Recommended)
Cursor membaca file `.cursorrules` di root direktori proyek Anda secara otomatis untuk memberikan instruksi sistem kepada AI.

1. Hubungkan atau buat file `.cursorrules` di root proyek Anda.
2. Gabungkan aturan umum dengan aturan spesifik proyek Anda:
   ```bash
   # Contoh 1: Proyek Next.js + NestJS Backend + Testing
   cat general-rules.md frontend-nextjs-rules.md backend-rules.md testing-rules.md > /path/to/your/project/.cursorrules

   # Contoh 2: Proyek Mobile React Native + Testing
   cat general-rules.md frontend-reactnative-rules.md testing-rules.md > /path/to/your/project/.cursorrules
   ```
3. Buka Cursor, dan setiap kali Anda melakukan interaksi Chat atau Editor Command (Cmd+K / Ctrl+K), Cursor akan menyelaraskan kodenya dengan aturan di atas.

### Skenario 2: Menggunakan Windsurf
Windsurf mendukung konfigurasi aturan sistem global melalui berkas `.windsurfrules`.

1. Buat file `.windsurfrules` di root proyek Anda.
2. Salin konten aturan yang relevan ke dalam file tersebut (gabungan aturan general + modul spesifik + testing).
3. AI agent di Windsurf akan mematuhi aturan tersebut sebagai instruksi instruktur utama.

### Skenario 3: Menggunakan GitHub Copilot (VS Code)
GitHub Copilot di VS Code dapat dikonfigurasi menggunakan berkas instruksi khusus `.github/copilot-instructions.md`.

1. Buat folder dan file: `.github/copilot-instructions.md` di root proyek Anda.
2. Salin seluruh berkas aturan yang berlaku untuk proyek tersebut ke dalam berkas tersebut.
3. Copilot akan mendeteksi berkas ini secara otomatis dan menggunakannya sebagai konteks tambahan saat menyusun autocomplete maupun chat response.

### Skenario 4: Sebagai Proyek Custom Chat (Gemini / Claude / ChatGPT)
Jika Anda berinteraksi dengan AI melalui antarmuka web chat (seperti Claude Projects atau Custom GPTs):

1. Buat Project baru di Claude.ai atau buat Custom GPT di ChatGPT.
2. Unggah berkas markdown aturan ini (`general-rules.md`, `testing-rules.md`, dll.) ke dalam bagian **Files / Knowledge Context**.
3. Berikan instruksi sistem: *"Anda wajib merujuk ke berkas aturan terlampir untuk setiap penulisan dan perbaikan kode dalam sesi ini."*

---

## ⚖️ Analisis Pro & Kontra (Pros & Cons)

Penerapan standar **AI Rules** pada workspace memiliki kompromi dan keuntungan tersendiri. Rincian singkat mengenai hal tersebut adalah sebagai berikut:

### 🟢 Kelebihan (Pros)
1. **Konsistensi Arsitektur Mutlak**: Menghilangkan variasi kode yang tidak terstandarisasi antar pengembang maupun AI.
2. **Kecepatan Code Review**: Memangkas perdebatan seputar naming convention, formatting, dan celah keamanan standar pada saat Pull Request (PR).
3. **Mencegah Penurunan Kualitas oleh AI**: AI cenderung menulis kode instan tercepat yang minim pertimbangan keamanan. Berkas rules ini bertindak sebagai guardrail otomatis.

### 🔴 Kelemahan & Konsekuensi (Cons)
1. **Boilerplate/Kode Tambahan**: Aturan ketat (seperti DTO/validation schema, pemisahan layer, lokalisasi i18n) memaksa penulisan kode tambahan yang lebih panjang pada awal pembuatan fitur.
2. **Overhead Pemeliharaan Rules**: Jika dependensi atau arsitektur proyek berubah, dokumen rules ini wajib diperbarui secara manual agar instruksi sistem tidak menyesatkan AI.

---

### 📘 Analisis Lengkap Pilihan Teknologi & State Management
Untuk tinjauan mendalam mengenai pro dan kontra dari pemilihan tumpukan teknologi (seperti NestJS, Next.js App Router, React Native/Expo, TanStack Query, Zustand, dan Vanilla CSS) yang disyaratkan oleh panduan ini, silakan merujuk ke berkas:
👉 **[pros-and-cons.md](file:///home/beta/workspace/starter-kit/ai-rules/pros-and-cons.md)**

---

## 👥 Sebagai Panduan Kerja Tim (Onboarding)

Letakkan folder `ai-rules/` ini di dalam folder dokumentasi tim Anda (misal: `docs/ai-rules/`) di repositori utama Git Anda.
*   **Merge Request / Pull Request Checklist**: Tambahkan prasyarat pada template PR untuk memastikan kode baru mematuhi aturan-aturan ini sebelum disetujui.
*   **Git Hook**: Anda bisa menggunakan perkakas seperti `husky` untuk menjalankan linter (`npm run lint:fix`) sebelum melakukan commit guna memastikan standar pemformatan terpenuhi otomatis.
