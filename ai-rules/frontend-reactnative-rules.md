# AI Rules: Frontend (React Native & Expo)

Dokumen ini berisi standar coding, optimalisasi performa, struktur aplikasi, dan best practices untuk proyek frontend mobile menggunakan **React Native** dan **Expo**.

---

## ⚡ TL;DR — Aturan Wajib (Quick Reference untuk AI)

> Baca bagian ini terlebih dahulu. Ini adalah aturan paling kritis yang TIDAK BOLEH dilanggar.

1. **DILARANG** menggunakan `{value && <Component />}` jika `value` bisa berupa string kosong `""` — gunakan `{!!value && <Component />}` untuk mencegah crash.
2. **DILARANG** menggunakan `FlatList` untuk daftar data besar — gunakan `@shopify/flash-list`.
3. **DILARANG** membuat komponen UI dari nol jika sudah tersedia di React Native Reusables (Expo).
4. **WAJIB** menggunakan TanStack Query untuk semua server state — dilarang menyimpan data API ke state Zustand.
5. **WAJIB** menggunakan NativeWind untuk styling — hindari `StyleSheet.create` manual.
6. **WAJIB** menggunakan `useMounted` untuk browser/native-only conditional rendering jika diperlukan.
7. Animasi **wajib** menggunakan `react-native-reanimated` (UI thread), bukan Animated API bawaan.
8. Gunakan Safe Area (`useSafeAreaInsets`) pada setiap screen untuk menghindari notch/navigation bar.
9. **DILARANG** menyimpan kredensial/token sensitif di `AsyncStorage` — wajib gunakan `expo-secure-store` atau `react-native-keychain`.
10. **WAJIB** memvalidasi deep link menggunakan *Universal Links* (iOS) atau *App Links* (Android) untuk alur transaksi/sensitif demi mencegah hijacking.
11. **WAJIB** mengelompokkan kode menggunakan **Feature-Based Folder Structure** dan membatasi impor antar-fitur hanya melalui pintu utama (`index.ts` / barrel file) demi menjaga modularitas kode.
12. **DILARANG** menggabungkan Tailwind/NativeWind class secara dinamis dengan string interpolasi — tulis class secara utuh dan lengkap.
13. **WAJIB** mengonfigurasi `filterTouchesWhenObscured = true` di Android untuk tombol aksi kritis guna mencegah serangan Tapjacking.

---

## 1. React Native (Expo) Best Practices

### A. Performa Rendering & List
*   **Optimasi List**: Hindari penggunaan `FlatList` bawaan untuk daftar data yang besar atau kompleks. Gunakan **@shopify/flash-list** karena performa rendering ulangnya jauh lebih efisien dan meminimalkan memory footprint.
*   **Prevent Re-renders**: Gunakan `React.memo` pada item list, serta `useCallback` dan `useMemo` untuk callback handler dan kalkulasi data yang berat untuk menjaga frame rate tetap mulus di 60 FPS (atau 120 FPS).
*   **Inline Functions**: Hindari menulis fungsi inline (seperti `onPress={() => doSomething()}`) di dalam render prop komponen list karena hal tersebut membuat referensi fungsi baru di setiap render.

### B. Platform-Specific Code & Safe Area
*   **Platform Detection**: Gunakan ekstensi file `.ios.tsx` dan `.android.tsx` untuk memisahkan implementasi spesifik platform yang kompleks. Gunakan `Platform.select()` untuk perbedaan styling kecil.
*   **Safe Areas**: Selalu gunakan komponen dari `react-native-safe-area-context` (seperti `SafeAreaView` atau hook `useSafeAreaInsets`) untuk memastikan UI tidak tertutup oleh notch, kamera, atau navigation bar sistem operasi.

### C. Caching & Media Mobile
*   **Fast Image**: Gunakan library caching gambar seperti **react-native-fast-image** (atau Expo Image jika menggunakan Expo SDK) untuk melakukan cache agresif terhadap gambar jarak jauh (remote images), menghindari lag saat scrolling.

### D. Keyboard Overlap Handling
*   **Pencegahan Overlap Input**: Pada perangkat mobile, keyboard virtual yang muncul berisiko menutup field input teks di bagian bawah layar.
*   **Wajib Gunakan Keyboard Wrapper**:
    *   Setiap screen yang berisi input form **wajib** dibungkus menggunakan komponen `KeyboardAvoidingView` bawaan React Native (dengan properti `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`) atau menggunakan library **`react-native-keyboard-controller`** untuk penanganan pergeseran layout yang otomatis dan mulus.
    *   Gunakan `ScrollView` dengan properti `keyboardShouldPersistTaps="handled"` agar keyboard menutup ketika user mengetuk area di luar input.

### E. AppState Handling (Background vs Foreground)
*   **Hemat Baterai & Resource**: Aplikasi mobile sering kali dipindahkan ke latar belakang (*background*). Membiarkan koneksi socket, pencarian GPS, atau polling API tetap aktif di background akan menghabiskan baterai ponsel dan berujung pada penolakan di App Store/Google Play.
*   **Wajib Gunakan AppState Listener**:
    *   Gunakan hook atau event listener `AppState` untuk mendeteksi perubahan status aplikasi.
    *   Hentikan (*pause*) polling, putuskan koneksi WebSocket, dan matikan tracking saat aplikasi berstatus `background` atau `inactive`, dan nyalakan kembali saat berstatus `active`.
    ```typescript
    useEffect(() => {
      const subscription = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'background') {
          // Matikan koneksi / polling / tracking
        } else if (nextAppState === 'active') {
          // Jalankan kembali
        }
      });
      return () => subscription.remove();
    }, []);
    ```

### F. Preloading Assets & Splash Screen
*   **Mencegah Flash UI Kosong**: Splash screen bawaan OS sering kali hilang sebelum font kustom atau aset lokal (logo/gambar utama) selesai dimuat, menyebabkan UI terlihat melompat atau kosong sekejap.
*   **Wajib Tahan Splash Screen**:
    *   Gunakan API Splash Screen (seperti `expo-splash-screen`) untuk mencegah splash screen menyembunyikan dirinya secara prematur.
    *   Tahan pemanggilan `SplashScreen.hideAsync()` sampai semua aset krusial (font, icon, gambar utama) selesai dimuat ke dalam memori cache.

### G. Device Hardware Permissions Handling
*   **Pencegahan Force Close**: OS mobile (iOS & Android) akan langsung menghentikan aplikasi secara paksa jika kode mencoba memanggil sensor/hardware (Kamera, Lokasi GPS, Notifikasi, Photo Library) sebelum status izin disetujui oleh user.
*   **Wajib Periksa Status Izin**:
    *   **Wajib** memanggil fungsi pengecekan izin resmi (`expo-permissions`, `expo-camera`, `expo-location`, atau `react-native-permissions`) sebelum menginisialisasi kamera/GPS.
    *   **Wajib** menangani skenario jika izin ditolak secara permanen (*Permanently Denied*) dengan menampilkan dialog ramah yang mengarahkan user ke menu Pengaturan Sistem (Settings) ponsel untuk mengaktifkan izin secara manual.

---

## 2. Data Fetching & State Management

### A. Pembagian Tanggung Jawab State (State Segmentation)
*   **Wajib Mematuhi Segmentasi State**: Untuk mencegah *state spaghetti* dan kebocoran memori, patuhi aturan pembagian state berikut secara mutlak:
    1.  **Server State (API Data)**: **Wajib** menggunakan **TanStack Query (React Query)**. Dilarang menyimpan salinan data response API ke dalam store Zustand atau local state `useState` untuk pemakaian jangka panjang. TanStack Query bertanggung jawab atas caching, sinkronisasi, dan optimasi data server.
    2.  **Global Client State (Non-API)**: **Wajib** menggunakan **Zustand**. Hanya digunakan untuk data global yang murni berasal dari client dan tidak tersimpan di database (seperti status login token offline, preferensi tema gelap/terang, status onboarding steps).
    3.  **Local UI State**: **Wajib** menggunakan **`useState`** atau **`useReducer`** lokal. Hanya digunakan untuk status UI sementara yang terbatas di dalam satu komponen (atau diturunkan maksimal 1 tingkat ke child component), seperti status checkbox tercentang, toggle dropdown, status modal terbuka/tutup, atau teks input sementara sebelum disubmit.

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

### C. Zustand Best Practices
*   **Atomic Selectors**: Selalu gunakan pemilih atomik (`const sidebarOpen = useStore((state) => state.sidebarOpen)`) saat mengonsumsi store Zustand untuk mencegah render ulang komponen yang tidak perlu saat property store lain berubah.
*   **Zustand Persist dengan MMKV**: Di React Native, jika menggunakan middleware `persist` pada Zustand, wajib menggunakan **`react-native-mmkv`** sebagai storage engine (bukan `AsyncStorage`) karena performa I/O-nya jauh lebih cepat dan berjalan secara sinkronus.

### D. Skalabilitas Struktur Kode: Feature-Based Architecture
*   **Domain-driven Folder Structure**: Untuk menjaga agar repositori tetap rapi dan terukur seiring berkembangnya aplikasi, **dilarang** menumpuk semua komponen, hooks, dan service di folder global. Kelompokkan kode berbasis **fitur/domain bisnis** di dalam folder `src/features/`.
*   **Struktur Folder Fitur Standar**:
    ```
    src/
    ├── components/       # Shared UI components global (Button, Card, Input)
    ├── features/         # Modul berbasis fitur/domain
    │   ├── auth/         # Fitur Autentikasi
    │   │   ├── components/
    │   │   ├── hooks/
    │   │   ├── services/
    │   │   └── index.ts   # Pintu keluar/masuk tunggal (Public API) untuk modul ini
    │   └── billing/      # Fitur Pembayaran/Billing
    ```
*   **Module Isolation (Encapsulation) & Barrel Files**:
    *   Setiap folder fitur wajib mengekspor komponen, hooks, atau tipe datanya yang bersifat publik melalui sebuah file `index.ts` (barrel file) di root folder fitur tersebut.
    *   **Dilarang keras** mengimpor file internal dari fitur lain secara acak. Fitur lain hanya boleh mengimpor apa yang diekspor secara resmi di file `index.ts` utama (misal: `import { LoginForm } from '@/features/auth'`). Ini menjaga agar dependensi antar fitur tetap bersih dan tidak saling mengunci (*tight coupling*).

---

## 3. UI/Styling & Animasi

### A. UI Framework & Styling Standards
*   **NativeWind**: Wajib menggunakan **NativeWind** (TailwindCSS untuk React Native) untuk styling. Hindari penulisan `StyleSheet.create` manual, gunakan atribut `className` untuk menerapkan gaya secara deklaratif.
*   **React Native Reusables (RNR)**: Wajib menggunakan library komponen [React Native Reusables](https://reactnativereusables.com/) (shadcn/ui untuk React Native). Manfaatkan primitives dari RNR untuk memastikan aksesibilitas dan performa UI yang mulus di platform mobile.
*   **Design Tokens & Theme Consistency**: Selalu gunakan utility class warna, ukuran spasi, dan tipografi yang terdaftar di konfigurasi tema (`tailwind.config.js`). Hindari penggunaan arbitrary values kasar (seperti `bg-[#ff5522]` atau `w-[327px]`) di luar token desain.
*   **Responsivitas**: Gunakan penghitungan persentase atau helper dimensi layar (`Dimensions.get('window')`) untuk menangani berbagai resolusi layar ponsel secara dinamis.

### B. Animasi Berkinerja Tinggi
*   **Reanimated**: Gunakan **react-native-reanimated** untuk membuat animasi berjalan langsung di UI thread (bukan JS thread) guna menghindari lag/frame drop saat JS thread sedang sibuk.

### C. Aturan Penggunaan Memoization (useMemo & useCallback)
*   **Hindari Over-use Memoization**: **Dilarang** membungkus semua fungsi dan variabel dengan `useCallback` atau `useMemo` tanpa alasan yang jelas. Memoization memiliki biaya overhead memori dan CPU untuk menyimpan dan membandingkan array dependensi.
*   **Kapan Menggunakan `useMemo`**: Gunakan **hanya** untuk mengoptimalkan kalkulasi CPU-heavy (seperti memproses, menyaring, atau memetakan array yang berisi ratusan/ribuan data).
*   **Kapan Menggunakan `useCallback`**: Gunakan **hanya** ketika fungsi tersebut dioperasikan sebagai prop ke child component yang menggunakan `React.memo` (atau library pihak ketiga yang sensitif terhadap referensi fungsi, seperti react-native-reanimated).

---

## 4. Penanganan Error & Gotchas Umum (Troubleshooting)

### A. React Native Crash: Text Outside `<Text>`
*   **Deskripsi Error**: *"Render Error: Text strings must be rendered within a <Text> component."*
*   **Penyebab**: Menulis teks mentah di luar komponen `<Text>`. Gotcha yang paling umum adalah mengevaluasi string kosong `""` atau nullish value menggunakan operator logical AND (`&&`) dalam JSX. Contoh: `{user.name && <Profile name={user.name} />}` — jika `user.name` adalah string kosong `""`, React Native akan mencoba merender string kosong tersebut di luar `<Text>` dan menyebabkan crash.
*   **Solusi & Aturan**:
    1.  **Konversi Boolean Eksplisit**: Selalu gunakan konversi boolean eksplisit (`!!` atau perbandingan nilai) saat merender komponen bersyarat:
        *   ❌ *Salah*: `{user.name && <Profile />}` (Akan crash jika name = `""`)
        *   ✔️ **Benar**: `{!!user.name && <Profile />}` atau `{user.name.length > 0 && <Profile />}`
    2.  **Bungkus String**: Pastikan seluruh teks mentah dibungkus oleh komponen `<Text>` dari `react-native`.

### B. NativeWind Dynamic Classnames Mismatch
*   **Deskripsi Error**: Gaya/styling tidak berjalan atau hilang secara acak pada beberapa elemen dinamis.
*   **Penyebab**: NativeWind melakukan analisis statis (*static scanning*) pada source code untuk mencari classname yang utuh saat proses build. Penggabungan string dinamis (seperti `className={`bg-${color}-500`}`) membuat compiler tidak mengenali class tersebut.
*   **Solusi & Aturan**:
    1.  **Tulis Class secara Utuh**: Jangan pernah menggabungkan nama class menggunakan variabel dinamis. Tulis nama class secara lengkap dalam skema percabangan objek/ternary.
        *   ❌ *Salah*: `className={`text-${status === 'active' ? 'green' : 'red'}-600`}`
        *   ✔️ **Benar**: `className={status === 'active' ? 'text-green-600' : 'text-red-600'}`

---

## 5. Mobile Security & Vulnerability Prevention

### A. Secure Storage di Mobile
*   **Insecure AsyncStorage**: `AsyncStorage` bawaan React Native menyimpan data secara plaintext dalam sistem berkas lokal tanpa enkripsi. Sangat berbahaya jika digunakan untuk menyimpan kredensial sensitif.
*   **Aturan Penyimpanan Token**:
    *   **Dilarang keras** menyimpan Access Token, Refresh Token, PIN, atau data personal sensitif lainnya ke dalam `AsyncStorage`.
    *   **Wajib** menggunakan library secure storage bawaan OS yang terenkripsi di level hardware (Keychain di iOS, Shared Preferences di Android dengan Master Key):
        *   Jika menggunakan **Expo**: gunakan `expo-secure-store`.
        *   Jika menggunakan **Bare React Native**: gunakan `react-native-keychain` atau `react-native-encrypted-storage`.

### B. Deep Link Hijacking Prevention
*   **Skema Custom (`myapp://`) yang Rentan**: Skema custom deep link tidak terverifikasi kepemilikannya oleh sistem operasi. Aplikasi jahat lain di ponsel yang sama dapat mendaftarkan skema yang sama untuk mencegat token/data sensitif.
*   **Aturan Implementasi**:
    *   Untuk alur kritis (seperti reset password, otentikasi login, transaksi pembayaran), **wajib** menggunakan **Universal Links (iOS)** dan **App Links (Android)** berbasis HTTPS domain resmi yang terverifikasi (menggunakan file `.well-known/apple-app-site-association` dan `assetlinks.json` di server).
    *   Validasi isi parameter (token, payload) secara ketat di sisi server sebelum memproses permintaan yang bersumber dari deep link.

### C. SSL Pinning untuk Aplikasi Mobile Kritis
*   **Man-in-the-Middle (MITM)**: Pada aplikasi mobile finansial atau aplikasi dengan tingkat keamanan tinggi, enkripsi HTTPS standar masih dapat disadap jika pengguna berada di jaringan Wi-Fi publik dengan sertifikat root yang disusupi.
*   **Aturan SSL Pinning**:
    *   Untuk aplikasi kritis, **wajib** mengonfigurasi **SSL Pinning** (mengikat sidik jari / fingerprint/hash sertifikat SSL server langsung di dalam bundle aplikasi mobile).
    *   Gunakan library tepercaya seperti `react-native-ssl-pinning` atau library HTTP client native yang mendukung pinning sertifikat (misal: penyesuaian OkHttpClient di Android dan TrustKit di iOS).
    *   *Peringatan*: Pastikan memiliki rencana pembaruan sertifikat cadangan di aplikasi sebelum sertifikat utama kedaluwarsa agar aplikasi tidak terkunci saat sertifikat server diperbarui.

### D. Tapjacking Protection (Android)
*   **Tapjacking / Screen Overlay Attack**: Pada sistem operasi Android, aplikasi latar belakang yang jahat dapat menggambar overlay transparan di atas aplikasi Anda, mencegat sentuhan layar user (misal: tombol pembayaran atau login) tanpa sepengetahuan user.
*   **Aturan Android Overlay**:
    *   Untuk form sensitif atau tombol aksi kritis di Android, konfigurasikan container utama atau modul native untuk mengabaikan sentuhan jika layar terhalang oleh aplikasi lain (`filterTouchesWhenObscured = true`).
    *   Di level Native Android (MainActivity/View):
        ```java
        view.setFilterTouchesWhenObscured(true);
        ```

### E. Global HTTP Interceptor (Token Refresh & Retry)
*   **Centralized Auth Error Handling**: Wajib mengonfigurasi interceptor pada HTTP client (seperti Axios interceptor atau wrapper Fetch global) untuk mendeteksi error `401 Unauthorized` secara otomatis di tingkat global.
*   **Silent Token Refresh Workflow**:
    1.  Jika menerima response status `401`, cegat request tersebut.
    2.  Picu pemanggilan API token refresh menggunakan Refresh Token yang tersimpan aman di secure storage (`expo-secure-store`/`react-native-keychain`).
    3.  Jika refresh berhasil, perbarui access token dalam memori request, lalu **ulangi (*retry*)** request asli yang sempat gagal secara transparan kepada user.
    4.  Jika refresh gagal (atau refresh token kedaluwarsa), hapus sesi di client (hapus token dari secure storage) dan arahkan user secara paksa ke layar `/login`.

### F. Standar Masking Data Sensitif di UI (PII Protection)
*   **Masking Data Pengguna**: Untuk data pribadi sensitif (Personally Identifiable Information - PII) seperti email, nomor telepon, alamat, atau nomor rekening yang dirender di layar:
    *   **Wajib** melakukan sensor/masking data sebelum dirender ke layar.
    *   Hanya tampilkan data utuh jika pengguna menekan tombol toggle "lihat/mata" secara aktif.
    *   *Contoh Format*:
        *   Email: `john.doe@gmail.com` -> `jo**.d**@gmail.com`
        *   Telepon: `081234567890` -> `0812-****-7890`

---

## 6. Internationalization (i18n) Standards

### A. Framework Pendukung (react-i18next)
*   **Wajib Lokalisasi**: Untuk mendukung multi-bahasa (i18n) di mobile, **dilarang** menulis label teks, pesan error, atau deskripsi UI secara hardcode langsung di komponen React Native.
*   **i18next**: Gunakan library **`react-i18next`** dikombinasikan dengan `i18next` dan plugin pelacak bahasa native untuk memetakan terjemahan bahasa.
*   **Struktur File Kamus**: Kelompokkan berkas lokalisasi dalam bentuk JSON di folder terpusat (misal: `src/locales/id.json` dan `src/locales/en.json`).

### B. Penggunaan Komponen Teks Lokalisasi
*   **Dilarang Teks Tanpa Text Component**: Gunakan hook `useTranslation` dan pastikan hasil terjemahan dibungkus dalam komponen `<Text>` bawaan React Native.
    ```typescript
    import { useTranslation } from 'react-i18next';
    import { Text } from 'react-native';

    export function WelcomeLabel() {
      const { t } = useTranslation();
      return <Text>{t('common.welcome')}</Text>;
    }
    ```

---

## 7. Client-Side Error Boundary & Crash Reporting

### A. Fallback UI dengan React Error Boundary
*   **Wajib Gunakan Error Boundary**: Unhandled crash di React Native dapat langsung menutup aplikasi secara paksa (*force close*) ke launcher ponsel. Wajib membungkus root component aplikasi dengan **Error Boundary** kustom untuk meredam crash dan menampilkan fallback UI (seperti layar pemberitahuan "Terjadi kesalahan, silakan restart aplikasi") yang ramah pengguna.
*   **Integrasi Crash Reporting (Sentry)**:
    *   Wajib mengintegrasikan SDK **Sentry** (`@sentry/react-native`) untuk memantau crash secara live di production.
    *   Bungkus root component aplikasi dengan `Sentry.wrap`:
        ```typescript
        import * as Sentry from '@sentry/react-native';

        Sentry.init({
          dsn: 'SENTRY_DSN_PROD',
        });

        function App() {
          return (
            <Sentry.ErrorBoundary fallback={<FallbackScreen />}>
              <MainNavigation />
            </Sentry.ErrorBoundary>
          );
        }

        export default Sentry.wrap(App);
        ```

### B. Manual Exception Tracking
*   Untuk error penting pada blok asynchronous yang aman dari crash (seperti kegagalan parse respon API yang aneh), wajib mencatatnya secara manual menggunakan `Sentry.captureException(error)` agar dapat dianalisis di dashboard Sentry.

