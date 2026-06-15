# AI Rules: Frontend (Next.js)

Dokumen ini berisi standar coding, optimalisasi performa, struktur aplikasi, dan best practices untuk proyek web frontend menggunakan **Next.js (App Router)**.

---

## ⚡ TL;DR — Aturan Wajib (Quick Reference untuk AI)

> Baca bagian ini terlebih dahulu. Ini adalah aturan paling kritis yang TIDAK BOLEH dilanggar.

1. **DILARANG** menambahkan `'use client'` di komponen induk — letakkan sedalam mungkin di pohon komponen (leaf components).
2. **DILARANG** fetch data di Client Component jika bisa dilakukan di Server Component.
3. **DILARANG** menggabungkan Tailwind class secara dinamis dengan string interpolasi — tulis class secara utuh dan lengkap.
4. **DILARANG** menyimpan token autentikasi di LocalStorage — gunakan HttpOnly Cookie.
5. **DILARANG** membuat komponen UI dari nol jika sudah tersedia di shadcn/ui.
6. **WAJIB** menggunakan `next/image` untuk semua gambar dengan properti `width`, `height`, dan `alt`.
7. **WAJIB** menggunakan TanStack Query untuk semua server state — dilarang menyimpan data API ke state Zustand.
8. **WAJIB** menambahkan `useTransition` + `isPending` pada setiap Server Action untuk mencegah double submit.
9. **WAJIB** menggunakan `useMounted` atau `next/dynamic` dengan `ssr: false` untuk browser-only components.
10. **WAJIB** menggunakan komponen `<Link>` dari `next/link` untuk semua navigasi internal.
11. **DILARANG** mengembalikan objek database mentah (seperti Prisma model) dari Server Actions — selalu potong data sensitif sebelum di-return ke client.
12. **DILARANG** membocorkan rahasia backend di variabel lingkungan Next.js — variabel rahasia dilarang menggunakan prefix `NEXT_PUBLIC_`.
13. **DILARANG** merender HTML mentah secara bebas — wajib disanitasi menggunakan `DOMPurify` saat menggunakan `dangerouslySetInnerHTML`.
14. **WAJIB** mengonfigurasi CSP (Content Security Policy) dan memblokir iframe pihak ketiga (anti-clickjacking).
15. **WAJIB** menggunakan `rel="noopener noreferrer"` untuk semua tautan eksternal (`target="_blank"`) guna menghindari celah Reverse Tabnabbing.
16. **WAJIB** menetapkan properti `priority` pada gambar *above-the-fold* (LCP) dan menyediakan Skeleton / tinggi tetap untuk elemen asinkronus demi mencegah CLS.
17. **WAJIB** mengelompokkan kode menggunakan **Feature-Based Folder Structure** dan membatasi impor antar-fitur hanya melalui pintu utama (`index.ts` / barrel file) demi menjaga modularitas kode.

---

## 1. Next.js (App Router) Best Practices

### A. Server Components (RSC) vs Client Components (RCC)
*   **Default to RSC**: Buat komponen sebagai React Server Component (RSC) secara default untuk mengurangi ukuran bundle JavaScript yang dikirim ke browser.
*   **RCC Leaf-Level**: Gunakan arahan `'use client'` hanya saat dibutuhkan (event listeners, state `useState`/`useReducer`, lifecycle hooks, browser-only APIs seperti `window` atau `localStorage`). Letakkan `'use client'` sedalam mungkin di pohon komponen (leaf components) agar halaman induk tetap dirender di server.
*   **Data Fetching**: Lakukan fetch data langsung di Server Components (menggunakan `async/await` di fungsi komponen) atau via Server Actions untuk menghindari pengiriman kredensial API ke client.

### B. Routing & Server Actions
*   **Server Actions**: Gunakan Server Actions untuk mutasi data (POST, PUT, DELETE). Gabungkan dengan `useTransition` untuk menampilkan status loading di sisi client dan lakukan revalidasi cache data menggunakan `revalidatePath` atau `revalidateTag`.
*   **Parallel & Intercepting Routes**: Manfaatkan fitur ini untuk membuat modal atau dashboard multi-panel yang memiliki URL sendiri (bisa dibagikan/bookmark) tanpa merusak konteks halaman di bawahnya.

### C. SEO & Metadata
*   **Static & Dynamic Metadata**: Selalu tentukan objek `metadata` statis untuk halaman statis, dan gunakan fungsi `generateMetadata` untuk halaman dinamis (seperti detail produk atau artikel blog).
*   **Semantic HTML**: Gunakan elemen semantik (`<header>`, `<main>`, `<nav>`, `<footer>`, `<article>`, `<aside>`) untuk SEO dan aksesibilitas (a11y).
*   **JSON-LD**: Tambahkan data terstruktur menggunakan skema JSON-LD untuk memberikan konteks kaya bagi mesin pencari.

### D. Optimasi Bawaan Next.js
*   **Images (`next/image`)**: Selalu gunakan komponen Image bawaan. Wajib menyertakan properti `width` & `height` (atau `fill` dengan parent `position: relative`), `alt` yang dengan deskripsi jelas, dan properti `priority` untuk gambar LCP (above-the-fold).
*   **Navigation (`next/link`)**: Gunakan `<Link>` untuk navigasi internal guna memanfaatkan fitur prefetching halaman saat link masuk ke viewport.

### E. Optimasi Core Web Vitals & Bundle Size
*   **LCP (Largest Contentful Paint) Optimization**:
    *   **Priority Loading**: Gambar utama di halaman (*above-the-fold* seperti hero banner, logo utama, atau gambar produk di landing page) **wajib** menggunakan properti `priority` dan `fetchPriority="high"`.
    *   **Dilarang** menggunakan *lazy loading* (`loading="lazy"`) pada gambar-gambar LCP ini karena akan menunda pemuatan gambar dan menurunkan skor LCP.
*   **CLS (Cumulative Layout Shift) Prevention**:
    *   **Tinggi/Lebar Tetap**: Setiap komponen yang memuat konten secara asinkronus (seperti iklan, widget pihak ketiga, peta, atau list dinamis) **wajib** dibungkus dalam container yang memiliki tinggi minimal tetap (`min-h-[x]` atau aspek rasio tetap) atau menggunakan **Skeleton Loader**. Hal ini mencegah konten lain terdorong ke bawah secara tiba-tiba (*layout shift*) saat konten async tersebut ter-load.
*   **INP (Interaction to Next Paint) Optimization**:
    *   **Deferred State Updates**: Untuk input interaktif yang memicu kalkulasi berat atau penyaringan list data yang besar secara real-time, **wajib** menggunakan React 18 `useTransition` atau `useDeferredValue` agar main thread browser tetap responsif dan ketikan keyboard pengguna tidak mengalami lag/delay.
*   **Bundle Size & Code Splitting**:
    *   **Named & Destructured Imports**: Hindari melakukan impor library secara penuh yang dapat menggagalkan *tree-shaking*. Gunakan named imports spesifik.
    *   **Dynamic Imports (`next/dynamic`)**: Gunakan `dynamic()` dengan opsi `ssr: false` untuk memecah (*code-splitting*) modul atau library besar yang tidak dibutuhkan pada rendering awal (seperti library grafik Recharts, Rich Text Editor, PDF generator, atau modal dialog kompleks).

### F. Proteksi Route & Autentikasi (Middleware)
*   **Centralized Route Protection**: **Wajib** melindungi rute-rute privat (seperti `/dashboard`, `/settings`, `/admin`) secara terpusat di dalam berkas **`middleware.ts`** di root proyek. Hindari menulis logika pengecekan token/autentikasi secara manual di dalam setiap layout atau page.
*   **Pencegahan Flash Content**: Dengan menaruh proteksi di Middleware, request akan dicegat sebelum halaman dirender oleh server/browser, sehingga mencegah kebocoran visual konten privat (*flash of unauthorized content*).
*   **Contoh Implementasi Middleware**:
    ```typescript
    import { NextResponse } from 'next/server';
    import type { NextRequest } from 'next/server';

    const privateRoutes = ['/dashboard', '/settings', '/admin'];

    export function middleware(request: NextRequest) {
      const token = request.cookies.get('access_token')?.value;
      const { pathname } = request.nextUrl;

      const isPrivateRoute = privateRoutes.some((route) => pathname.startsWith(route));

      if (isPrivateRoute && !token) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname); // simpan redirect URL
        return NextResponse.redirect(loginUrl);
      }

      return NextResponse.next();
    }

    export const config = {
      matcher: ['/dashboard/:path*', '/settings/:path*', '/admin/:path*'],
    };
    ```

### G. Optimasi Font (`next/font`)
*   **Wajib `next/font/google`**: Gunakan modul `next/font/google` untuk memuat semua font kustom. Ini otomatis melakukan *self-hosting* berkas font pada server Next.js, meningkatkan privasi dan kecepatan loading.
*   **Zero Layout Shift**: Gunakan CSS variabel yang digenerate oleh `next/font` untuk disematkan pada tag HTML utama agar font cadangan (*fallback font*) memiliki rasio ukuran yang sama dengan font utama, mencegah Cumulative Layout Shift (CLS) saat font utama selesai di-load.

### H. Route-level Loading States (loading.tsx & Suspense)
*   **Instant Visual Feedback**: Untuk setiap rute yang melakukan fetch data di server (SSR), **wajib** membuat berkas **`loading.tsx`** di tingkat folder rute utama tersebut.
*   **Skeleton Loader**: Isi berkas `loading.tsx` harus merender *Skeleton Loader* yang menyerupai bentuk layout asli halaman (bukan loader spinner kosong) untuk menjaga kestabilan layout visual dan meningkatkan kenyamanan transisi halaman bagi pengguna.

---

## 2. Data Fetching & State Management

### A. Pembagian Tanggung Jawab State (State Segmentation)
*   **Wajib Mematuhi Segmentasi State**: Untuk mencegah *state spaghetti* dan kebocoran memori, patuhi aturan pembagian state berikut secara mutlak:
    1.  **Server State (API Data)**: **Wajib** menggunakan **TanStack Query (React Query)**. Dilarang menyimpan salinan data response API ke dalam store Zustand atau local state `useState` untuk pemakaian jangka panjang.
    2.  **Global Client State (Non-API)**: **Wajib** menggunakan **Zustand**. Hanya digunakan untuk data global yang murni berasal dari client dan tidak tersimpan di database (seperti status login token offline, preferensi tema, status sidebar, dsb).
    3.  **Local UI State**: **Wajib** menggunakan **`useState`** atau **`useReducer`** lokal. Hanya digunakan untuk status UI sementara yang terbatas di dalam satu komponen.
    4.  **URL State (Search/Filters/Pagination)**: Status pencarian, filter, tab aktif, dan halaman paginasi **wajib** disimpan di URL query parameters menggunakan `useSearchParams` dan `useRouter`. **Dilarang keras** menyimpan data ini di dalam React `useState` atau Zustand karena akan merusak history browser.

### B. TanStack Query (React Query) Best Practices
*   **Custom Hooks**: Bungkus query dan mutasi ke dalam custom hooks per fitur.
    ```typescript
    // features/users/hooks/useUser.ts
    export const useUser = (userId: string) => {
      return useQuery({
        queryKey: ['users', userId],
        queryFn: () => fetchUser(userId),
        staleTime: 5 * 60 * 1000, // 5 menit
      });
    };
    ```
*   **Optimistic Updates**: Terapkan *Optimistic Updates* pada mutasi UI kritis (seperti tombol like/bookmark) untuk meningkatkan persepsi kecepatan aplikasi bagi pengguna.

### C. Zustand Best Practices & Hydration Safety (SSR Compatibility)
*   **Atomic Selectors**: Selalu gunakan pemilih atomik (`const sidebarOpen = useStore((state) => state.sidebarOpen)`) saat mengonsumsi store Zustand untuk mencegah render ulang komponen yang tidak perlu.
*   **Hydration Mismatch Prevention**: Next.js melakukan SSR. Jika Zustand menggunakan `persist` middleware, render awal di server tidak memiliki akses ke LocalStorage. Wajib pastikan state Zustand hanya dibaca setelah komponen ter-mount di client menggunakan `isMounted` pattern.

### D. Skalabilitas Struktur Kode: Feature-Based Architecture
*   **Domain-driven Folder Structure**: Kelompokkan kode berbasis **fitur/domain bisnis** di dalam folder `src/features/`.
*   **Struktur Folder Fitur Standar**:
    ```
    src/
    ├── components/       # Shared UI components global
    ├── features/         # Modul berbasis fitur/domain
    │   ├── auth/         # Fitur Autentikasi
    │   │   ├── components/
    │   │   ├── hooks/
    │   │   ├── services/
    │   │   └── index.ts   # Barrel file
    ```
*   **Module Isolation & Barrel Files**: Gunakan `index.ts` untuk mengekspor API publik fitur. **Dilarang** mengimpor file internal antar fitur secara acak.

### E. Pemahaman Caching Next.js App Router
*   **Invalidasi**: Gunakan **`revalidatePath(path)`** atau **`revalidateTag(tag)`** di dalam Server Actions setelah mutasi data.
*   **Dynamic**: Gunakan `export const dynamic = 'force-dynamic';` untuk halaman real-time.

### F. Standar Validasi Form (React Hook Form + Zod)
*   **Wajib**: Gunakan **React Hook Form** dikombinasikan dengan skema validasi **Zod**. Dilarang menggunakan state manual untuk input form.

---

## 3. UI/Styling & Animasi

### A. UI Framework & Styling Standards
*   **TailwindCSS**: Wajib menggunakan TailwindCSS sebagai utility-first CSS framework utama.
*   **shadcn/ui**: Wajib menggunakan **shadcn/ui** untuk komponen UI dasar (Button, Dialog, Dropdown, Input, dll.). Jangan membuat komponen UI kompleks dari nol jika sudah disediakan oleh shadcn/ui. Gunakan perintah `npx shadcn@latest add <component-name>` untuk memasang komponen baru.
*   **Design Tokens & Theme Consistency**: Selalu gunakan utility class warna, ukuran spasi, dan tipografi yang terdaftar di konfigurasi tema (`tailwind.config.js`). Hindari penggunaan arbitrary values kasar (seperti `bg-[#ff5522]` atau `w-[327px]`) di luar token desain.
*   **Responsivitas**: Gunakan modifier responsif Tailwind (`sm:`, `md:`, `lg:`) untuk menangani berbagai resolusi layar.

### B. Animasi Berkinerja Tinggi
*   **CSS Transitions**: Gunakan transition CSS bawaan atau keyframes untuk efek hover/fokus untuk performa animasi yang mulus.

### C. Aturan Penggunaan Memoization (useMemo & useCallback)
*   **Hindari Over-use Memoization**: **Dilarang** membungkus semua fungsi dan variabel dengan `useCallback` atau `useMemo` tanpa alasan yang jelas. Memoization memiliki biaya overhead memori dan CPU untuk menyimpan dan membandingkan array dependensi.
*   **Kapan Menggunakan `useMemo`**: Gunakan **hanya** untuk mengoptimalkan kalkulasi CPU-heavy (seperti memproses, menyaring, atau memetakan array yang berisi ratusan/ribuan data).
*   **Kapan Menggunakan `useCallback`**: Gunakan **hanya** ketika fungsi tersebut dioperasikan sebagai prop ke child component yang menggunakan `React.memo` (atau library pihak ketiga yang sensitif terhadap referensi fungsi).

---

## 4. Penanganan Error & Gotchas Umum (Troubleshooting)

### A. Next.js Hydration Mismatch
*   **Deskripsi Error**: *"Hydration failed because the initial UI does not match what was rendered on the server."*
*   **Penyebab**: Kode HTML yang dibuat di server berbeda dengan HTML yang dirender oleh browser pada render pertama. Sering terjadi akibat tanggal dinamis (`new Date()`), pengecekan ukuran layar (`window.innerWidth`), atau struktur tag HTML yang tidak valid (misal: memasukkan tag `<div>` di dalam tag `<p>`).
*   **Solusi & Aturan**:
    1.  **Gunakan Hook `useMounted`**: Untuk komponen yang bergantung pada client-only state atau browser API, pastikan dirender hanya setelah komponen terpasang (*mounted*).
        ```typescript
        const [isMounted, setIsMounted] = useState(false);
        useEffect(() => setIsMounted(true), []);
        if (!isMounted) return <Skeleton />;
        ```
    2.  **Dynamic Import**: Gunakan `next/dynamic` dengan opsi `{ ssr: false }` untuk komponen yang sepenuhnya menggunakan browser API.
    3.  **Struktur HTML Valid**: Patuhi spesifikasi W3C. Jangan menumpuk elemen block-level (seperti `div`, `section`) di dalam elemen inline (seperti `span`, `p`).

### B. Tailwind CSS Dynamic Classnames Mismatch
*   **Deskripsi Error**: Gaya/styling tidak berjalan atau hilang secara acak pada beberapa elemen dinamis.
*   **Penyebab**: Tailwind CSS melakukan analisis statis (*static scanning*) pada source code untuk mencari classname yang utuh saat proses build. Penggabungan string dinamis (seperti `className={`bg-${color}-500`}`) membuat compiler tidak mengenali class tersebut.
*   **Solusi & Aturan**:
    1.  **Tulis Class secara Utuh**: Jangan pernah menggabungkan nama class menggunakan variabel dinamis. Tulis nama class secara lengkap dalam skema percabangan objek/ternary.
        *   ❌ *Salah*: `className={`text-${status === 'active' ? 'green' : 'red'}-600`}`
        *   ✔️ **Benar**: `className={status === 'active' ? 'text-green-600' : 'text-red-600'}`

### C. Server Action Timeout / Multiple Submissions
*   **Deskripsi Error**: Form tersubmit berkali-kali secara tidak sengaja oleh user saat koneksi lambat, atau UI terlihat macet tanpa adanya respon.
*   **Penyebab**: Memicu Server Action langsung melalui onClick tanpa menonaktifkan button atau menampilkan feedback loading.
*   **Solusi & Aturan**:
    1.  **Gunakan `useTransition`**: Bungkus pemanggilan Server Action ke dalam hook `useTransition` dan gunakan status `isPending` untuk menonaktifkan tombol submit dan memunculkan loading spinner.
        ```typescript
        const [isPending, startTransition] = useTransition();
        const onSubmit = () => {
          startTransition(async () => {
            await myServerAction();
          });
        };
        return <button disabled={isPending}>{isPending ? 'Saving...' : 'Save'}</button>;
        ```
    2.  **HTML Form Action**: Jika menggunakan elemen `<form>`, manfaatkan hook `useFormStatus` pada komponen tombol anak (child component) untuk membaca status `pending` form secara otomatis.

### D. Handling Exceptions in Server Actions
*   **Dilarang Melempar Exception Langsung**: Server Actions **dilarang keras** membiarkan runtime error/exception terlempar secara global tanpa ditangkap (`throw new Error(...)`). Hal ini karena Next.js akan langsung menganggapnya sebagai unhandled error, memotong proses, dan merender layar crash `error.tsx` ke pengguna.
*   **Wajib Tangkap & Kembalikan Respons Terstruktur**: Bungkus seluruh logika di dalam Server Action dengan blok `try/catch` dan kembalikan objek error terstruktur yang dapat dibaca dan ditampilkan secara ramah oleh UI client.
    *   ❌ **Salah**:
        ```typescript
        // Server Action
        export async function registerUser(data: RegisterDto) {
          const exists = await prisma.user.findUnique({ where: { email: data.email } });
          if (exists) throw new Error('Email sudah terdaftar'); // akan men-trigger layar error.tsx crash
          return prisma.user.create({ data });
        }
        ```
    *   ✔️ **Benar**:
        ```typescript
        // Server Action
        export async function registerUser(data: RegisterDto) {
          try {
            const exists = await prisma.user.findUnique({ where: { email: data.email } });
            if (exists) {
              return { success: false, error: 'Email sudah terdaftar' };
            }
            const user = await prisma.user.create({ data });
            return { success: true, data: user };
          } catch (e) {
            return { success: false, error: 'Terjadi kesalahan sistem, silakan coba lagi.' };
          }
        }
        ```

---

## 5. Frontend Security & Vulnerability Prevention

### A. Server Actions Data Leakage Prevention
*   **Prinsip Sanitasi Data**: Server Actions secara implisit membuat endpoint HTTP POST publik yang mengembalikan data dalam format JSON. Me-return objek database mentah dari Server Actions berisiko tinggi membocorkan properti sensitif (seperti `passwordHash`, `isAdmin`, `billingId`, dll.) ke sisi client.
*   **Aturan Desain**: **Dilarang keras** mengembalikan instance model database langsung ke client. Selalu buat objek respons baru yang ter-sanitize atau lakukan pemetaan (mapping) eksplisit sebelum me-return data.
    *   ❌ **Salah**:
        ```typescript
        // Server Action
        export async function getUserProfile(id: string) {
          return prisma.user.findUnique({ where: { id } }); // Membocorkan passwordHash, dll.
        }
        ```
    *   ✔️ **Benar**:
        ```typescript
        // Server Action
        export async function getUserProfile(id: string) {
          const user = await prisma.user.findUnique({ where: { id } });
          if (!user) return null;
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
          }; // Hanya data publik yang dikirim ke browser
        }
        ```

### B. Environment Variables Security (`NEXT_PUBLIC_`)
*   **Aturan Penamaan Environment Variables**:
    *   Variabel lingkungan yang memiliki awalan `NEXT_PUBLIC_` akan dikompilasi secara hardcode ke dalam kode JavaScript yang dikirimkan ke client. Siapa pun dapat membacanya melalui browser developer tools.
    *   **Dilarang keras** menaruh secret key, private key, token API pihak ketiga (seperti Stripe Secret Key, Firebase Service Account, database connection string, dll.) di dalam variabel yang diawali dengan `NEXT_PUBLIC_`.
*   **Proteksi Server-side Only**: Biarkan variabel sensitif dideklarasikan tanpa prefix `NEXT_PUBLIC_`. Variabel ini secara otomatis bernilai `undefined` di browser/client, melindungi rahasia backend dari paparan eksternal.

### C. Cross-Site Scripting (XSS) Prevention via Sanitization
*   **Bahaya `dangerouslySetInnerHTML`**: Menyisipkan HTML mentah langsung ke DOM tanpa sanitasi adalah celah utama serangan XSS di React.
*   **Aturan Sanitasi**: Jika aplikasi terpaksa merender input HTML yang berasal dari user atau database eksternal (seperti output WYSIWYG editor):
    *   **Wajib** menyaring string HTML tersebut menggunakan library sanitasi seperti **isomorphic-dompurify** sebelum merendernya.
    *   ❌ **Salah**:
        ```typescript
        // Rentan terhadap XSS jika blogContent berisi payload <img src=x onerror=alert(1)>
        return <div dangerouslySetInnerHTML={{ __html: blogContent }} />;
        ```
    *   ✔️ **Benar**:
        ```typescript
        import DOMPurify from 'isomorphic-dompurify';

        const sanitizedContent = DOMPurify.sanitize(blogContent);
        return <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />;
        ```

### D. Content Security Policy (CSP) & Clickjacking Protection
*   **Content Security Policy**: Wajib mengonfigurasi CSP header guna membatasi eksekusi skrip berbahaya, inline styles, dan pemanggilan resource eksternal tak terdaftar.
    *   Terapkan CSP melalui Next.js Middleware (`middleware.ts`) atau `next.config.js` headers.
    *   Format dasar CSP minimal:
        ```
        default-src 'self';
        script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com; // batasi asal script
        style-src 'self' 'unsafe-inline';
        img-src 'self' data: https:;
        frame-ancestors 'none'; // mencegah clickjacking
        ```
*   **Anti-Clickjacking**:
    *   Pastikan aplikasi tidak dapat dirender di dalam `<iframe>` milik domain lain dengan mengirimkan header `X-Frame-Options: DENY` (atau `SAMEORIGIN` jika dibutuhkan oleh subdomain internal).
    *   Gunakan direktif CSP `frame-ancestors 'self'` atau `frame-ancestors 'none'` untuk melarang frame-nesting secara modern.

### E. Proteksi Link Eksternal (Reverse Tabnabbing)
*   **Bahaya `target="_blank"`**: Saat merender tautan dengan `target="_blank"`, halaman baru yang dibuka mendapatkan akses parsial ke objek `window.opener` halaman asal Anda. Halaman baru tersebut bisa mengubah URL halaman asal Anda ke situs phishing (`window.opener.location = "https://phishing.com"`) tanpa disadari user.
*   **Aturan Tautan**:
    *   **Wajib** menyertakan atribut `rel="noopener noreferrer"` pada setiap tag tautan (`<a>`) eksternal yang menggunakan `target="_blank"`.
    *   ❌ **Salah**:
        ```typescript
        <a href="https://external-website.com" target="_blank">Kunjungi Mitra</a>
        ```
    *   ✔️ **Benar**:
        ```typescript
        <a href="https://external-website.com" target="_blank" rel="noopener noreferrer">Kunjungi Mitra</a>
        ```
    *   *Catatan*: Komponen `<Link>` bawaan `next/link` secara default sudah menangani ini dengan aman, namun tag `<a>` HTML murni wajib dikonfigurasi manual.

### F. Global HTTP Interceptor (Token Refresh & Retry)
*   **Centralized Auth Error Handling**: Wajib mengonfigurasi interceptor pada HTTP client (seperti Axios interceptor atau wrapper Fetch global) untuk mendeteksi error `401 Unauthorized` secara otomatis di tingkat global.
*   **Silent Token Refresh Workflow**:
    1.  Jika menerima response status `401`, cegat request tersebut.
    2.  Picu pemanggilan API token refresh menggunakan Refresh Token yang tersimpan aman di HTTP-only cookie.
    3.  Jika refresh berhasil, perbarui access token dalam memori request, lalu **ulangi (*retry*)** request asli yang sempat gagal secara transparan kepada user.
    4.  Jika refresh gagal (atau refresh token kedaluwarsa), hapus sesi di client dan arahkan user secara paksa ke halaman `/login`.

### G. Standar Masking Data Sensitif di UI (PII Protection)
*   **Masking Data Pengguna**: Untuk data pribadi sensitif (Personally Identifiable Information - PII) seperti email, nomor telepon, alamat, atau nomor rekening yang dirender di layar:
    *   **Wajib** melakukan sensor/masking data sebelum dirender ke DOM.
    *   Hanya tampilkan data utuh jika pengguna menekan tombol toggle "lihat/mata" secara aktif.
    *   *Contoh Format*:
        *   Email: `john.doe@gmail.com` -> `jo**.d**@gmail.com`
        *   Telepon: `081234567890` -> `0812-****-7890`

---

## 6. Internationalization (i18n) Standards

### A. Framework Pendukung (next-intl)
*   **Wajib Lokalisasi**: Untuk mendukung multi-bahasa (i18n), **dilarang** menulis label teks, pesan error, atau deskripsi UI secara hardcode di dalam file komponen JSX.
*   **next-intl**: Gunakan library **`next-intl`** untuk integrasi i18n dengan App Router Next.js (baik di Server Components maupun Client Components).
*   **Struktur File Kamus**: Simpan file kamus lokalisasi dalam format JSON di folder `messages/` (misal: `messages/id.json` untuk Bahasa Indonesia, `messages/en.json` untuk Bahasa Inggris).

### B. Cara Penggunaan di Komponen
*   **Server & Client Usage**: Gunakan hook `useTranslations` untuk mengambil label bahasa:
    ```typescript
    import { useTranslations } from 'next-intl';

    export function WelcomeButton() {
      const t = useTranslations('Welcome');
      return <button>{t('ctaButton')}</button>;
    }
    ```

---

## 7. Client-Side Error Boundary & Crash Reporting

### A. Fallback UI dengan `error.tsx` (Next.js)
*   **Wajib Gunakan Error Boundary Rute**: Next.js App Router mendukung file khusus **`error.tsx`** di setiap tingkat folder rute. Wajib membuat `error.tsx` untuk menangani runtime crash di rute tersebut, menampilkan fallback UI yang ramah, dan mencegah layar putih kosong (*White Screen of Death*).
*   **Contoh Implementasi `error.tsx`**:
    ```typescript
    'use client';

    import { useEffect } from 'react';

    export default function Error({
      error,
      reset,
    }: {
      error: Error & { digest?: string };
      reset: () => void;
    }) {
      useEffect(() => {
        // Laporkan error ke monitoring service (Sentry)
        console.error(error);
      }, [error]);

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <h2>Terjadi kesalahan pada sistem.</h2>
          <button onClick={() => reset()} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded">
            Coba Lagi
          </button>
        </div>
      );
    }
    ```

### B. Crash Reporting Terintegrasi (Sentry)
*   **Otomatisasi Capture**: Integrasikan SDK **Sentry** untuk menangkap unhandled client-side exceptions secara otomatis di production.
*   **Manual Capture**: Untuk error yang ditangkap di blok `try/catch` tetapi perlu dilaporkan secara khusus:
    ```typescript
    import * as Sentry from '@sentry/nextjs';

    try {
      // proses berisiko
    } catch (error) {
      Sentry.captureException(error);
    }
    ```

