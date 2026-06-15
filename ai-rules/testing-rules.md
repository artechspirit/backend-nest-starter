# AI Rules: Testing & Quality Assurance

Dokumen ini berisi standar pengujian perangkat lunak, arsitektur tes, metodologi mocking, target coverage, dan best practices untuk menjaga keandalan kode di seluruh platform (Backend NestJS, Frontend Next.js, dan Mobile React Native).

---

## ⚡ TL;DR — Aturan Wajib (Quick Reference untuk AI)

> Baca bagian ini terlebih dahulu. Ini adalah aturan paling kritis yang TIDAK BOLEH dilanggar saat menulis tes.

1. **DILARANG** melakukan network calls asli (fetch API, external request) atau koneksi database riil di dalam **Unit Test**. Wajib menggunakan mocking penuh.
2. **DILARANG** menulis tes tanpa assertion (`expect`). Tes yang hanya memicu fungsi tanpa memvalidasi hasilnya dianggap tidak valid.
3. **WAJIB** menargetkan minimal **80% test coverage** pada logika bisnis utama (Core Services, Helpers, Utils, dan Domain Rules).
4. **WAJIB** membersihkan data dan mereset status mock (`jest.clearAllMocks()` / `vi.clearAllMocks()`) sebelum atau sesudah setiap pengujian dijalankan.
5. **WAJIB** menggunakan **Mock Service Worker (MSW)** untuk mocking API pada Integration/Component Test di Frontend (Next.js & React Native).
6. **WAJIB** menggunakan **Database Sandbox** khusus yang terisolasi untuk Integration/E2E Test yang menyentuh database. Dilarang keras memakai database development.
7. **WAJIB** menguji jalur negatif (negative paths), penanganan error (error handling), dan nilai batas (edge cases) — dilarang hanya menguji skenario sukses (happy paths).
8. **DILARANG** membiarkan pengujian bergantung pada waktu/tanggal lokal sistem. Wajib menggunakan mock time (`useFakeTimers`) jika logika kode memproses tanggal atau waktu dinamis.
9. **WAJIB** memastikan tes bersifat deterministik (tidak boleh fluktuatif / flaky). Hindari hardcoded delay (`setTimeout`) di dalam tes; gunakan polling asinkronus (`waitFor`).

---

## 1. Filosofi Pengujian & Cakupan (Test Coverage)

### A. Piramida Pengujian (Testing Pyramid)
Untuk efisiensi biaya komputasi dan kecepatan feedback loop, patuhi proporsi piramida pengujian berikut:
*   **Unit Tests (70%)**: Menguji fungsi individual, utils, custom hooks, dan core service secara terisolasi. Harus berjalan dalam hitungan milidetik.
*   **Integration Tests (20%)**: Menguji interaksi antar komponen, integrasi service dengan database sandbox, atau integrasi UI dengan API ter-mock (MSW).
*   **End-to-End (E2E) Tests (10%)**: Menguji alur bisnis kritis dari sudut pandang pengguna (user flow) menggunakan browser/emulator asli.

### B. Kebijakan Cakupan (Coverage Policy)
*   **Logika Bisnis Krusial**: Perhitungan harga, validasi token, otorisasi data, state transition, dan helper pengolah data **wajib** dilindungi tes dengan cakupan minimal **80%**.
*   **Dilarang Mengetes Kode Boilerplate**: Hindari menulis tes redundan untuk file yang tidak memiliki logika logika bisnis seperti:
    *   Prisma schemas (tipe data murni).
    *   NestJS Modules declaration (`*.module.ts`).
    *   File styling (CSS, Tailwind, NativeWind).
    *   Komponen UI statik tanpa state (kecuali tes regresi visual khusus).

### C. Pola AAA (Arrange, Act, Assert)
Setiap blok tes wajib disusun dengan struktur AAA yang jelas untuk mempermudah pembacaan:
```typescript
it('harus menghitung diskon dengan benar untuk pengguna VIP', () => {
  // 1. Arrange: Persiapkan data dan mock
  const originalPrice = 100000;
  const isVip = true;

  // 2. Act: Jalankan fungsi yang diuji
  const finalPrice = calculateDiscount(originalPrice, isVip);

  // 3. Assert: Validasi hasil
  expect(finalPrice).toBe(80000); // Diskon VIP 20%
});
```

---

## 2. Standar Unit Testing

### A. Konvensi Penamaan Berkas
*   **Backend / NestJS**: `*.spec.ts` (ditempatkan berdampingan dengan file yang diuji).
*   **Frontend (Next.js & React Native)**: `*.test.tsx` atau `*.test.ts`.

### B. Isolasi Mutlak & Mocking
*   Semua eksternal resources wajib di-mock menggunakan API bawaan framework pengujian (Jest/Vitest).
*   **Mocking Prisma Client**: Gunakan mock otomatis (`jest-mock-extended` atau Vitest equivalent) untuk menghindari inisialisasi Prisma engine.
*   **Mocking Module/Library**: Gunakan `jest.mock('nama-library')` atau `vi.mock('nama-library')` di baris paling atas berkas untuk mencegah library asli memicu efek samping (seperti pengiriman email asli melalui `nodemailer`).

### C. Penanganan Waktu & Tanggal (Time-Safe Tests)
Pengujian yang memproses waktu sering kali gagal saat berjalan di server CI/CD karena perbedaan zona waktu (UTC vs GMT+7).
*   **Aturan**: Selalu bekukan waktu sistem saat menjalankan tes yang berkaitan dengan manipulasi tanggal.
```typescript
// Menggunakan Vitest
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-11T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});
```

---

## 3. Standar Integration Testing

### A. Backend (NestJS + Prisma Sandbox DB)
Untuk integration test yang memverifikasi controller dan repositori, gunakan basis data pengujian yang terpisah dan bersih.
*   **Prisma Test Schema Sandbox**:
    *   Gunakan skema database khusus (misal: schema PostgreSQL dinamis per-thread tes) untuk mencegah bentrokan data antar pengujian yang berjalan paralel.
    *   Jalankan migrasi database di lingkungan tes sebelum pengujian dimulai (`npx prisma migrate deploy`).
*   **Data Cleanup**:
    *   **Wajib** membersihkan (truncate/reset) tabel database setelah setiap blok tes (`afterEach`) selesai berjalan agar tidak meracuni status tes berikutnya.
```typescript
// src/test/database-cleaner.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function cleanDatabase() {
  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations';
  `;

  for (const { tablename } of tablenames) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
    } catch (error) {
      console.error(`Gagal melakukan truncate tabel ${tablename}:`, error);
    }
  }
}
```

### B. Frontend Web & Mobile (Next.js / React Native + MSW)
*   **API Mocking dengan MSW (Mock Service Worker)**:
    *   **Dilarang** mem-mock fungsi fetch/axios secara global secara manual (`global.fetch = jest.fn()`). Ini tidak realistis dan rentan bocor.
    *   **Wajib** menggunakan **MSW** untuk mencegat jaringan di level HTTP layer. MSW memungkinkan pengujian menggunakan API handler tiruan yang perilakunya sangat mirip dengan server backend asli.
*   **Konfigurasi Server MSW**:
```typescript
// src/mocks/server.ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/v1/users/profile', () => {
    return HttpResponse.json({
      success: true,
      data: { id: 'usr-1', name: 'John Doe', email: 'john@example.com' },
      error: null,
    });
  }),
];

export const server = setupServer(...handlers);
```
*   **Integrasi ke Siklus Pengujian**:
```typescript
// vitest.setup.ts atau jest.setup.js
import { server } from './src/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### C. Pengujian State Management (Zustand & TanStack Query)
*   **Zustand Reset**:
    *   Karena store Zustand bersifat global, status state tersimpan di memori proses tes.
    *   **Wajib** membuat helper reset state untuk setiap store Zustand dan memicu reset tersebut pada `afterEach` di lingkungan tes.
*   **TanStack Query Wrapper**:
    *   Saat menguji komponen atau custom hook yang menggunakan `useQuery`, bungkus render component dengan `QueryClientProvider` baru yang memiliki konfigurasi `retry: false` untuk mempercepat kegagalan tes saat memproses jalur error.

---

## 4. Standar End-to-End (E2E) Testing

### A. Web (Playwright)
*   **Scope**: E2E test hanya diaplikasikan pada alur bisnis utama (critical user journeys):
    1.  Autentikasi (Register, Login, MFA, Password Reset).
    2.  Alur Transaksi Utama (Pencarian barang -> Masuk Keranjang -> Checkout -> Pembayaran).
    3.  Manajemen Pengguna (Update profile, Ganti password, Unggah berkas sensitif).
*   **Data Isolation**:
    *   Gunakan database sandbox terpisah untuk pengujian Playwright.
    *   Setiap suite pengujian Playwright wajib menjalankan database seeder (`npx prisma db seed`) untuk memastikan tersedianya data awal (seperti data produk default, akun user testing) sebelum browser terbuka.
*   **Pola Pengujian Tanpa Flaky (Anti-Flaky Elements)**:
    *   **Dilarang** menggunakan hardcoded sleep (`page.waitForTimeout(3000)`).
    *   Gunakan locators bawaan Playwright yang secara otomatis menunggu elemen tampil (*auto-waiting*):
        *   `await page.getByRole('button', { name: 'Bayar Sekarang' }).click();`
        *   `await expect(page.locator('.toast-success')).toBeVisible();`

### B. Mobile (Detox / Expo Test)
*   **Simulator Isolation**:
    *   Pastikan build biner aplikasi (`.app` atau `.apk`) dipersiapkan khusus untuk skenario pengujian dengan API target yang diarahkan ke local server MSW / mock backend api.
*   **Test ID Binding**:
    *   Gunakan prop `testID` (React Native) untuk mengikat elemen UI agar mudah diidentifikasi oleh test runner Detox:
        ```jsx
        <TouchableOpacity testID="btn-submit-login">
          <Text>Login</Text>
        </TouchableOpacity>
        ```
    *   Gunakan locator `by.id('btn-submit-login')` dalam script Detox.

---

## 5. Standar Component & UI Testing

### A. React Testing Library (RTL)
*   **User Interaction**: Gunakan `@testing-library/user-event` daripada `fireEvent` untuk mensimulasikan interaksi keyboard dan mouse karena mensimulasikan event browser secara lebih akurat.
*   **Query Priority**:
    *   Patuhi prioritas pencarian elemen berdasarkan standar aksesibilitas RTL:
        1.  `getByRole` (Prioritas Utama - ramah pembaca layar).
        2.  `getByLabelText` (Untuk form inputs).
        3.  `getByPlaceholderText` (Untuk input jika label tidak tersedia).
        4.  `getByText` (Untuk teks statis).
        5.  `getByTestId` (Pilihan Terakhir - hanya gunakan jika elemen tidak memiliki kriteria aksesibilitas di atas).

### B. Accessibility (a11y) Verification
*   Gunakan library **`jest-axe`** (atau Vitest equivalent) untuk melakukan audit aksesibilitas otomatis dasar pada komponen yang dirender:
```typescript
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import MyComponent from './MyComponent';

expect.extend(toHaveNoViolations);

it('komponen harus lulus audit aksesibilitas (a11y)', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## 6. Otomatisasi, Git Hooks & CI/CD Gating

### A. Pre-commit Hooks (Husky & lint-staged)
*   Untuk mencegah kode rusak masuk ke histori Git repositori, wajib dikonfigurasi **Husky** bersama **lint-staged**.
*   **Aturan**:
    *   Sebelum commit disimpan (`pre-commit`), jalankan linter (`eslint --fix`) dan unit test khusus untuk file yang di-stage (`git diff --name-only`).
    *   Jika pengujian gagal, proses commit harus dibatalkan otomatis.

### B. CI/CD Pull Request Gateway
*   Setiap Pull Request yang diajukan ke branch utama (`main`/`develop`) wajib memicu pengujian otomatis di pipeline CI/CD (GitHub Actions, GitLab CI/CD).
*   **Kriteria Kelulusan (PR Gate)**:
    1.  Langkah `lint` harus lulus tanpa error.
    2.  Seluruh Unit Test & Integration Test harus lulus 100%.
    3.  Langkah `build` harus sukses.
    4.  Cakupan pengujian (Coverage) wajib dilaporkan dan divalidasi tidak boleh turun di bawah **80%** untuk folder-folder logika bisnis.

---

## 7. Aturan Penulisan Test oleh AI (AI Agent Constraints)

Saat AI diminta menulis atau memperbaiki kode pengujian (tests) di repositori ini, AI wajib mengikuti instruksi mutlak berikut:

1.  **Dilarang Menulis Placeholder**: Tulis seluruh mock, data input, dan assertion secara lengkap. Jangan pernah memotong baris assertions dengan komentar `// TODO: add assertions`.
2.  **Uji Skenario Negatif**: Untuk setiap unit fungsi, wajib ditulis minimal 1 tes skenario sukses (happy path) dan minimal 2 tes skenario gagal (negative path/exception throw/invalid inputs).
3.  **Tipe Data Mock yang Valid**: Mock data yang dioperasikan ke fungsi harus mengikuti tipe data asli TypeScript secara ketat. Dilarang memasukkan properti acak yang tidak dideklarasikan di skema input.
4.  **Cegah Flaky Tests**: Jangan pernah menggunakan asinkronus berbasis waktu statis (`setTimeout` di JS atau timing sleep) untuk menunggu respons backend. Selalu gunakan helper asinkronus bawaan library pengujian seperti `waitFor` (RTL) atau Playwright automatic locators.
5.  **Verifikasi Format Error**: Saat menguji skenario gagal, jangan hanya memverifikasi status code (misal: 400), tetapi verifikasi juga struktur response error sesuai standar (§5. Universal Error & Response Format pada [general-rules.md](file:///home/beta/workspace/starter-kit/ai-rules/general-rules.md)).
