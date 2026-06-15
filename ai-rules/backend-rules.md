# AI Rules: Backend (NestJS)

Dokumen ini berisi standar arsitektur, validasi data, sistem keamanan, penanganan error, dan best practices untuk pengembangan backend berbasis **NestJS**.

---

## ⚡ TL;DR — Aturan Wajib (Quick Reference untuk AI)

> Baca bagian ini terlebih dahulu. Ini adalah aturan paling kritis yang TIDAK BOLEH dilanggar.

1. **DILARANG** mengakses `process.env` langsung — wajib pakai `ConfigService`.
2. **DILARANG** memanggil `new` untuk class yang dikelola NestJS — gunakan DI constructor injection.
3. **DILARANG** mengubah struktur database secara manual — wajib pakai `prisma migrate dev`.
4. **DILARANG** menyimpan file upload ke disk server — wajib gunakan Object Storage (S3/R2/GCS).
5. **DILARANG** menggunakan `origin: '*'` di konfigurasi CORS production.
6. **DILARANG** menulis SQL mentah tanpa parameterized query.
7. **DILARANG** memasukkan field `role`, `isAdmin`, `balance` ke dalam DTO endpoint publik (Mass Assignment).
8. **DILARANG** membedakan pesan error login/reset password untuk email terdaftar vs tidak terdaftar (User Enumeration).
9. **WAJIB** menggunakan `ValidationPipe` global dengan `whitelist: true` dan `forbidNonWhitelisted: true`.
10. **WAJIB** menggunakan Prisma `$transaction` untuk setiap multi-write yang saling bergantung.
11. **WAJIB** menggunakan URI versioning (`/api/v1/`) sejak endpoint pertama dibuat.
12. **WAJIB** menyertakan Correlation ID di setiap request dan log entry.
13. **WAJIB** mem-mock semua eksternal dependency (DB, Redis, API) di Unit Test.
14. **WAJIB** menambahkan `deletedAt DateTime?` (Soft Delete) untuk tabel data krusial.
15. **WAJIB** mengaktifkan `app.enableShutdownHooks()` dan endpoint `/health` di setiap aplikasi.
16. **WAJIB** hashing password dengan **Argon2id** atau **bcrypt** (cost ≥ 12). Dilarang MD5/SHA.
17. **WAJIB** memvalidasi kepemilikan resource di setiap query: `where: { id, userId: currentUser.id }` (anti-IDOR).
18. Refresh Token **wajib** disimpan di HttpOnly Cookie, bukan LocalStorage.
19. Untuk operasi yang tidak boleh duplikat (pembayaran, dll) — implementasikan **Idempotency Key**.
20. **WAJIB** memvalidasi tipe parameter route (`@Param()`) menggunakan pipe validator seperti `ParseUUIDPipe` atau `ParseIntPipe`.
21. **DILARANG** melakukan breaking database migrations secara langsung — wajib gunakan pola **Expand and Contract** (3-phase migration).
22. **WAJIB** menggunakan decorator `@Type(() => Number)` atau `@Type(() => Boolean)` pada properti DTO Query Param yang bersifat numeric/boolean.
23. **DILARANG** menggunakan Multer disk storage; upload wajib menggunakan memory buffer dan langsung diunggah ke S3 via `UploadService`.
24. **DILARANG** melakukan double-wrapping response (membungkus response secara manual di controller) karena global `ResponseInterceptor` sudah otomatis menangani standardisasi envelope data.
25. **WAJIB** mem-mock `PrismaService` beserta seluruh service eksternal (Redis, S3, BullMQ) di dalam semua file unit test (`*.spec.ts`).

---

## 1. Modular Architecture & Clean Code

### A. Modular Design & Dependency Injection
*   **Feature Modules**: Setiap fitur/domain bisnis wajib dibungkus ke dalam Modul tersendiri (misal: `AuthModule`, `UserModule`, `ProductModule`). Hindari memasukkan terlalu banyak logika ke dalam `AppModule` global.
*   **Dependency Injection (DI)**: Gunakan Dependency Injection bawaan NestJS secara ketat melalui constructor injection. Jangan pernah melakukan instansiasi class secara manual menggunakan kata kunci `new` untuk class yang dikelola oleh NestJS container (seperti Service atau Repository).
*   **Typed Configuration (ConfigService)**:
    *   **Dilarang keras** mengakses `process.env` secara langsung di dalam Service, Controller, atau Guard.
    *   **Wajib** menyuntikkan `ConfigService` (`@nestjs/config`) di constructor untuk mengakses environment variables guna menjaga keterujian (*testability*) dan kemudahan mem-mock konfigurasi.
*   **Interface Segregation**: Jika menggunakan arsitektur bersih (Clean/Hexagonal Architecture), definisikan Service dalam bentuk Interface, lalu bind implementasi konkretnya di modul menggunakan custom providers.

### B. Multi-Environment Readiness
*   **Struktur File Environment**:
    *   Setiap proyek wajib memisahkan konfigurasi berdasarkan environment ke dalam file `.env` yang terpisah:
        ```
        .env                    # Nilai default / fallback (tidak mengandung rahasia)
        .env.development        # Konfigurasi khusus lingkungan lokal development
        .env.staging            # Konfigurasi khusus lingkungan staging (UAT)
        .env.production         # Konfigurasi khusus lingkungan production (TIDAK disimpan di Git)
        .env.test               # Konfigurasi khusus saat menjalankan pengujian otomatis
        .env.example            # Template env yang WAJIB ada di repositori sebagai referensi key (tanpa value rahasia)
        ```
    *   **Yang wajib masuk `.gitignore`**: `.env`, `.env.production`, `.env.staging`, `.env.development.local`.
    *   **Yang wajib ada di Git**: `.env.example` (berisi seluruh key tanpa value rahasia, sebagai kontrak konfigurasi untuk developer baru).
*   **Konfigurasi Bertipe Kuat (Strongly-Typed Config)**:
    *   **Wajib** menggunakan **Typed Configuration Namespaces** dari `@nestjs/config` untuk memvalidasi dan mengelompokkan konfigurasi berdasarkan domain:
        ```typescript
        // config/database.config.ts
        export const databaseConfig = registerAs('database', () => ({
          url: process.env.DATABASE_URL,
          pool: parseInt(process.env.DB_POOL_SIZE, 10) ?? 5,
        }));
        ```
    *   Gabungkan dengan validasi Zod (atau Joi) di `ConfigModule` untuk memastikan aplikasi gagal booting secara awal (*fail-fast*) jika ada variabel konfigurasi yang tidak valid atau hilang.
*   **Deteksi Environment**:
    *   Definisikan helper terpusat untuk mendeteksi environment yang sedang berjalan. Hindari pengecekan `process.env.NODE_ENV === 'production'` secara tersebar di berbagai file.
    *   Gunakan pola konstanta terpusat:
        ```typescript
        // src/common/env.ts
        export const isProduction = process.env.NODE_ENV === 'production';
        export const isDevelopment = process.env.NODE_ENV === 'development';
        export const isTest = process.env.NODE_ENV === 'test';
        ```
*   **Perilaku Berbeda antar Environment**:
    *   **Development**: Aktifkan request logging verbose, nonaktifkan caching, gunakan database lokal.
    *   **Staging**: Konfigurasi identik dengan production untuk tujuan UAT, namun menggunakan database dan secret key terpisah.
    *   **Production**: Nonaktifkan semua debug logging, aktifkan seluruh keamanan (Helmet, CORS ketat, Rate Limiting), gunakan Redis external dan database production.
    *   **Test**: Gunakan database testing terisolasi dan nonaktifkan semua log output saat pengujian berjalan.

### C. Konvensi Berkas NestJS
Setiap module harus mengikuti struktur konvensi penamaan standar NestJS:
```
src/
├── auth/
│   ├── dto/
│   │   ├── login.dto.ts
│   │   └── register.dto.ts
│   ├── entities/
│   │   └── user.entity.ts
│   ├── guards/
│   │   └── jwt-auth.guard.ts
│   ├── auth.controller.ts
│   ├── auth.module.ts
│   ├── auth.service.ts
│   └── auth.service.spec.ts
```

### D. Dekomposisi Service (Service Layer Size Limit)
*   **Batas Ukuran Service**: Jika sebuah Service sudah melampaui **~300 baris** atau mengandung lebih dari **5 method publik** yang menyentuh domain logika berbeda, itu pertanda Service tersebut sudah melanggar *Single Responsibility Principle* dan wajib dipecah.
*   **Pola Pemecahan**: Pecah berdasarkan *sub-domain* logika, bukan berdasarkan lapisan teknis:
    *   ❌ **Salah**: `OrderService` (2000 baris) menangani kalkulasi harga, validasi stok, notifikasi email, dan pembuatan invoice sekaligus.
    *   ✔️ **Benar**: `OrderService` (orkestrasi alur utama) → memanggil `OrderPricingService` (kalkulasi diskon, pajak) + `OrderNotificationService` (email, push notif) + `InvoiceService` (generate PDF).
*   **Aturan Penamaan**: Service turunan harus tetap berada di dalam folder modul yang sama dan diberi nama deskriptif: `{Module}{SubDomain}Service` (misal: `PaymentGatewayService`, `PaymentRefundService`).

### E. NestJS Request Lifecycle Standards
*   **Wajib Mematuhi Pembagian Peran**: Jangan mencampuradukkan logika bisnis, otorisasi, atau pembersihan data di berbagai siklus request NestJS. Patuhi aturan berikut:
    *   **Middleware**: Gunakan **hanya** untuk manipulasi tingkat rendah (misal: raw body parsing, cookies parsing, global IP filtering) sebelum payload didekode.
    *   **Guard**: Gunakan **hanya** untuk Autentikasi dan Otorisasi (menentukan apakah request boleh masuk atau ditolak). **Dilarang keras** memodifikasi request body atau melakukan validasi input/DTO di sini.
    *   **Interceptor**: Gunakan untuk transformasi data response global (seperti serialisasi, response wrapper), mekanisme caching response, atau monitoring performa (logging waktu eksekusi request).
    *   **Pipe**: Gunakan **hanya** untuk validasi data masukan (DTO) dan transformasi tipe data (misal: string ke integer/UUID/boolean).
    *   **Exception Filter**: Gunakan **hanya** untuk menangkap exception tak tertangani dan menyusun payload error seragam sebelum dikirim ke klien.
    *   **Anti-Double-Wrapping**: Controller **wajib** mengembalikan raw object atau data mentah langsung tanpa membungkusnya lagi dalam struktur envelope response standar (seperti `{ success: true, data: ... }`). Hal ini karena standardisasi format response (wrapping) sudah ditangani secara otomatis oleh `ResponseInterceptor` global. Melakukan pembungkusan manual di controller akan mengakibatkan double-wrapping.

---


## 2. Request Validation & Data Transfer Objects (DTO)

### A. Validasi DTO Ketat
*   **Class Validator**: Gunakan `class-validator` dan `class-transformer` untuk mendeklarasikan dan memvalidasi tipe data yang masuk melalui body request, query parameters, atau route params.
*   **Global Validation Pipe**: Wajib mengaktifkan `ValidationPipe` secara global di `main.ts` dengan konfigurasi aman:
    ```typescript
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,               // Menghapus properti yang tidak ada di DTO secara otomatis
        forbidNonWhitelisted: true,    // Mengembalikan error jika client mengirim properti tambahan yang tidak diizinkan
        transform: true,               // Mengonversi payload menjadi instance DTO (dan melakukan konversi tipe data otomatis seperti string ke number)
      }),
    );
    ```

### B. Serialisasi Output
*   **Class Serializer Interceptor**: Gunakan `ClassSerializerInterceptor` secara global atau pada level controller untuk memformat response payload secara otomatis.
*   **Exclude Sensitive Fields**: Tandai properti sensitif seperti `password`, `salt`, atau `internalSecret` menggunakan decorator `@Exclude()` pada class Entity/DTO agar tidak pernah terkirim ke klien secara tidak sengaja.

### C. Pencegahan Mass Assignment / Privilege Escalation
*   **Pisahkan DTO per Operasi**: Jangan menggunakan satu DTO untuk semua operasi (Create, Update, Admin Update). Buat DTO yang terpisah dan spesifik per use-case:
    *   `CreateUserDto` → hanya field yang boleh diisi oleh user saat registrasi.
    *   `UpdateProfileDto` → hanya field yang boleh diubah oleh user sendiri (misal: `name`, `avatar`).
    *   `AdminUpdateUserDto` → hanya digunakan oleh endpoint admin yang dilindungi guard `@Roles('ADMIN')`.
*   **Dilarang Keras** memasukkan field sensitif seperti `role`, `isAdmin`, `isVerified`, `balance`, atau `credits` ke dalam DTO yang dapat diakses oleh endpoint publik. Kesalahan ini memungkinkan penyerang meng-*escalate* privilege hanya dengan mengirimkan `{ "role": "admin" }` di body request.

### D. DTO Composition & Reusability
*   **Gunakan Mapped Types**: Untuk menghindari duplikasi field antar DTO yang saling mirip, gunakan utility dari `@nestjs/mapped-types` atau `@nestjs/swagger`:
    ```typescript
    // UpdateProductDto = semua field dari CreateProductDto, tapi semuanya opsional
    export class UpdateProductDto extends PartialType(CreateProductDto) {}

    // AdminUpdateProductDto = UpdateProductDto + field khusus admin
    export class AdminUpdateProductDto extends IntersectionType(
      UpdateProductDto,
      AdminFieldsDto,  // berisi: isPublished, isFeatured, moderationNote
    ) {}

    // Mengambil hanya sebagian field dari DTO lain
    export class ResetPasswordDto extends PickType(CreateUserDto, ['email'] as const) {}
    ```
*   **Jangan Duplikasi Manual**: Jika `CreateProductDto` memiliki 15 field dan `UpdateProductDto` hanya menjadikan semuanya opsional, **dilarang** menulis ulang ke-15 field tersebut secara manual. Gunakan `PartialType()` sehingga perubahan di `CreateProductDto` otomatis terefleksi di `UpdateProductDto`.

### E. Validasi Route & Query Parameters
*   **Wajib Validasi Tipe Parameter**: Setiap kali menerima parameter dari route (misal: `id`) atau query parameters, pastikan tipe datanya divalidasi secara eksplisit menggunakan NestJS built-in pipes (seperti `ParseUUIDPipe`, `ParseIntPipe`, `ParseBoolPipe`).
*   **Pencegahan Database Error**: Mencegah database crash akibat tipe parameter yang tidak sesuai (misal: database mengharapkan ID berupa UUID tetapi klien mengirim string acak).
    *   ❌ **Salah**:
        ```typescript
        @Get(':id')
        findOne(@Param('id') id: string) {
          return this.userService.findOne(id); // database akan melempar unhandled database exception jika id bukan UUID
        }
        ```
    *   ✔️ **Benar**:
        ```typescript
        @Get(':id')
        findOne(@Param('id', ParseUUIDPipe) id: string) {
          return this.userService.findOne(id);
        }
        ```
*   **Query Params Bertipe Kuat**: Untuk query parameters yang kompleks (seperti paginasi, filter), buatlah DTO khusus dan gunakan `@Query()` dikombinasikan dengan transformer (`class-transformer`) agar nilai string terkonversi menjadi tipe primitif yang benar (misal: string `'true'` menjadi boolean `true`).
*   **Parsing Tipe Data Query Parameter**: Wajib menggunakan decorator `@Type(() => Number)` atau `@Type(() => Boolean)` dari `class-transformer` untuk properti DTO query parameter yang bertipe numeric atau boolean. Tanpa decorator ini, properti tersebut akan tetap berupa string meskipun tipe Typescript dideklarasikan sebagai `number` atau `boolean`, yang berpotensi menyebabkan bug saat pengolahan logika atau pencarian database.

---

## 3. Security & Access Control

### A. Authentication & Authorization Guards
*   **Guards untuk Proteksi**: Gunakan NestJS Guards untuk mengelola proses autentikasi (misal: memeriksa JWT token) dan otorisasi (roles/permissions).
*   **Custom Decorators**: Buat decorator kustom seperti `@Public()` untuk menandai endpoint yang tidak memerlukan autentikasi, serta decorator `@Roles()` atau `@Permissions()` untuk otorisasi berbasis peran.
*   **Current User Decorator**: Buat custom decorator `@CurrentUser()` untuk mengambil informasi pengguna yang terautentikasi langsung dari objek request secara aman dan bertipe data kuat.

### A2. Token Lifecycle & Authentication Strategy
*   **Access Token + Refresh Token**:
    *   Gunakan dua jenis token: **Access Token** (umur pendek, 15 menit) untuk mengakses endpoint yang dilindungi, dan **Refresh Token** (umur panjang, 7-30 hari) untuk memperbarui Access Token yang sudah kadaluarsa.
    *   **Access Token**: Kirim via header `Authorization: Bearer <token>`.
    *   **Refresh Token**: Simpan di dalam **HttpOnly, Secure, SameSite=Strict Cookie** — bukan di LocalStorage — untuk mencegah pencurian via serangan XSS.
*   **Refresh Token Rotation**:
    *   Setiap kali Refresh Token digunakan untuk mendapatkan Access Token baru, invalidasi Refresh Token lama dan terbitkan Refresh Token baru (one-time use). Simpan hash dari Refresh Token yang aktif di database.
    *   Jika sebuah Refresh Token yang sudah digunakan (revoked) dipakai kembali (token reuse detection), segera invalidasi semua sesi pengguna tersebut sebagai tanda kebocoran token.
*   **Token Blacklist (Logout)**:
    *   Saat pengguna logout, masukkan Refresh Token ke dalam daftar hitam di Redis dengan TTL hingga token tersebut kadaluarsa secara alami.

### B. Pencegahan IDOR (Insecure Direct Object Reference)
*   **Validasi Kepemilikan Resource**: Ini adalah kerentanan paling umum di API produksi. Jangan hanya memvalidasi autentikasi (apakah sudah login), tetapi **wajib** juga memvalidasi otorisasi kepemilikan (apakah resource ini milik pengguna yang sedang aktif).
    *   ❌ **Salah** (vulnerable): `prisma.order.findUnique({ where: { id: orderId } })`
    *   ✔️ **Benar** (aman): `prisma.order.findUnique({ where: { id: orderId, userId: currentUser.id } })`
*   **Gunakan Resource-level Authorization**: Untuk kasus akses bersama (misal: member tim), implementasikan pemeriksaan kepemilikan berbasis relasi database sebelum query data dikembalikan — jangan mengandalkan logika di level controller semata.

### C. Password Hashing & Credential Security
*   **Algoritma Hashing Wajib**: Wajib menggunakan **Argon2id** (lebih direkomendasikan) atau **bcrypt** (minimum cost factor 12) untuk hashing password sebelum disimpan ke database.
*   **Dilarang** menggunakan MD5, SHA1, SHA256, atau SHA512 tanpa salt untuk hashing password — algoritma ini terlalu cepat dan rentan terhadap serangan rainbow table dan brute force.
*   **Perbandingan Password**: Selalu gunakan fungsi perbandingan yang constant-time (misal: `argon2.verify()` atau `bcrypt.compare()`) untuk mencegah serangan timing attack.
*   **Password Reset Flow**: Token reset password harus:
    1.  Di-generate menggunakan `crypto.randomBytes(32)` (bukan UUID yang predictable).
    2.  Disimpan dalam bentuk **hash** di database (bukan plaintext).
    3.  Memiliki masa berlaku singkat (maksimal **15 menit**).
    4.  Langsung **diinvalidasi setelah digunakan** (one-time use).

### D. JWT Security
*   **Algoritma JWT Eksplisit**: Wajib menentukan algoritma JWT secara eksplisit saat membuat dan memverifikasi token. Gunakan **RS256** (RSA asymmetric) untuk produksi, bukan HS256 yang mengandalkan satu shared secret.
    ```typescript
    JwtModule.register({
      algorithm: 'RS256',  // Wajib eksplisit
      privateKey: configService.get('JWT_PRIVATE_KEY'),
      publicKey: configService.get('JWT_PUBLIC_KEY'),
    })
    ```
*   **Tolak `alg: none`**: Pastikan library JWT yang digunakan secara otomatis menolak token dengan header `alg: none` untuk mencegah *algorithm confusion attack*.

### E. Account Security & Brute Force Protection
*   **Account Lockout**: Implementasikan mekanisme lockout pada endpoint login. Setelah **5 kali gagal login** dalam rentang 15 menit, blokir akun tersebut untuk login sementara dan kirim notifikasi email kepada pemilik akun.
    *   Simpan hitungan percobaan gagal di Redis dengan key berbasis email/username.
    *   Gunakan *exponential backoff* sebagai alternatif lockout keras untuk mengurangi risiko serangan DoS terhadap akun pengguna yang valid.
*   **Password Strength**: Terapkan kebijakan kekuatan password minimal: panjang minimal 8 karakter, minimal kombinasi huruf besar + huruf kecil + angka. Validasi ini dilakukan di DTO menggunakan `@Matches()` dari class-validator.
*   **Pencegahan User Enumeration**: Endpoint login dan password reset **dilarang** membocorkan informasi apakah sebuah email/username terdaftar atau tidak melalui pesan error yang berbeda.
    *   ❌ **Salah**: Login gagal → `"Email tidak ditemukan"` / `"Password salah"` (penyerang bisa menebak email mana yang terdaftar).
    *   ✔️ **Benar**: Login gagal → selalu kembalikan pesan generik yang **identik**: `"Email atau password tidak valid"` untuk kedua skenario.
    *   Terapkan pola yang sama pada endpoint password reset: selalu kembalikan `"Jika email terdaftar, kami telah mengirimkan instruksi reset"` — jangan beri tahu apakah email ditemukan atau tidak.

### F. SSRF (Server-Side Request Forgery) Prevention
*   **Dilarang** melakukan HTTP request ke URL yang berasal dari input pengguna (misal: URL gambar, webhook callback URL) tanpa validasi ketat.
*   **Validasi URL Sebelum Request**: Sebelum melakukan outbound HTTP request ke URL yang disediakan pengguna:
    1.  Validasi format URL menggunakan URL parsing standar.
    2.  **Whitelist domain** yang diizinkan jika memungkinkan.
    3.  **Blokir IP privat/loopback** (127.0.0.1, 169.254.169.254 AWS metadata, 10.x.x.x, 192.168.x.x) menggunakan library seperti `ssrf-agent`.

### G. Webhook Security
*   **Verifikasi Signature Wajib**: Saat menerima webhook dari pihak ketiga (Stripe, Midtrans, dll.), **wajib** memverifikasi keaslian payload menggunakan HMAC signature yang disediakan oleh pengirim webhook sebelum memproses apapun.
    ```typescript
    // Contoh verifikasi Stripe webhook
    const event = stripe.webhooks.constructEvent(
      rawBody,                          // Body HARUS raw bytes, bukan parsed JSON
      request.headers['stripe-signature'],
      configService.get('STRIPE_WEBHOOK_SECRET')
    );
    ```
*   **Gunakan Raw Body**: Middleware body parser JSON tidak boleh diaplikasikan pada route webhook — selalu gunakan raw bytes untuk keperluan verifikasi signature.

### H. API Versioning
*   **Wajib URI Versioning**: Semua endpoint API wajib menggunakan prefix versi URI sejak awal (`/api/v1/...`) untuk melindungi klien (mobile/web) dari breaking change di masa mendatang.
    ```typescript
    // main.ts
    app.enableVersioning({ type: VersioningType.URI });
    // Controller
    @Controller({ path: 'users', version: '1' })
    ```
*   **Deprecation Policy**: Jangan pernah menghapus atau mengubah kontrak (request/response shape) dari endpoint yang sudah aktif digunakan tanpa terlebih dahulu menyediakan versi baru dan memberi notifikasi kepada konsumen API.
*   **Breaking Change**: Setiap perubahan yang bersifat *breaking* (menghapus field, mengubah tipe data, mengubah status code) **wajib** dilakukan di versi baru (`v2`, `v3`), bukan dengan memodifikasi endpoint yang sudah ada.

### I. Keamanan Aplikasi Tingkat HTTP
*   **Helmet**: Integrasikan middleware `helmet` untuk menambahkan header keamanan HTTP penting (mencegah Clickjacking, XSS, sniffing, dll.).
*   **Payload Size Limit**: Batasi kapasitas maksimal upload JSON payload di NestJS (misal: Express `bodyParser` limit maksimal `10mb`) untuk mencegah serangan Denial of Service (DoS) dari payload ukuran raksasa.
*   **Rate Limiting**: Gunakan `@nestjs/throttler` pada endpoint publik (seperti Auth, Reset Password, Payment) untuk mencegah serangan brute force dan DDoS.
*   **CORS**: Atur konfigurasi Cross-Origin Resource Sharing (CORS) dengan benar. Jangan pernah menggunakan wildcard `origin: '*'` di lingkungan production.
*   **Prototype Pollution Prevention**: Penyerang dapat menyuntikkan key `__proto__`, `constructor`, atau `prototype` ke dalam payload JSON untuk memodifikasi `Object.prototype` global di Node.js, yang berpotensi menyebabkan bypass validasi atau remote code execution.
    *   **Wajib** mengaktifkan opsi `forbidNonWhitelisted: true` di `ValidationPipe` (sudah dikonfigurasi di §2.A) agar property asing termasuk `__proto__` ditolak secara otomatis.
    *   Sebagai lapisan pertahanan tambahan, pertimbangkan penggunaan middleware yang secara eksplisit menghapus key `__proto__`, `constructor.prototype` dari seluruh request body sebelum mencapai controller.

---

## 4. Error Handling & Logging

### A. Penanganan Exception
*   **Built-in HTTP Exceptions**: Gunakan HttpExceptions bawaan NestJS (`BadRequestException`, `UnauthorizedException`, `ForbiddenException`, `NotFoundException`, `InternalServerErrorException`) untuk mengembalikan error standar. Jangan pernah melempar error string kasar (`throw new Error('msg')`).
*   **Global Exception Filter**: Buatlah Custom Exception Filter global untuk menangkap semua error runtime, mencatatnya ke sistem logger, dan memformat response JSON error agar seragam bagi klien:
    ```json
    {
      "statusCode": 400,
      "message": "Validasi input gagal",
      "error": "Bad Request",
      "timestamp": "2026-06-10T16:00:00Z",
      "path": "/api/v1/auth/login"
    }
    ```
*   **Sembunyikan Detail Error di Production**: Global Exception Filter **wajib** mendeteksi lingkungan production dan menyembunyikan informasi error internal (stack trace, nama library, nama tabel database) dari response yang dikirim ke klien. Log detail teknis tetap dicatat di server, namun klien hanya menerima pesan generik:
    ```typescript
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      message: isProduction && status === 500 ? 'Internal server error' : exception.message,
      // Stack trace TIDAK PERNAH disertakan di response
    };
    ```

### B. Sistem Logging
*   **NestJS Logger**: Gunakan class `Logger` bawaan NestJS atau library logger terstruktur seperti **Pino/Winston** untuk mencatat log aktivitas aplikasi.
*   **Contextual Logging**: Selalu berikan nama context pada logger (`private readonly logger = new Logger(MyService.name)`) agar pelacakan log menjadi lebih mudah di lingkungan production.
*   **Format Log Berdasarkan Environment**:
    *   **Development**: Gunakan format logging human-readable / pretty printing (misal: `pino-pretty`) agar log mudah dibaca secara visual oleh developer.
    *   **Production & Staging**: Wajib menggunakan format **JSON terstruktur** (Structured JSON Logging). Log berformat JSON memudahkan mesin aggregator log (seperti Datadog, Grafana Loki, Elasticsearch/Kibana) untuk mengindeks field log (seperti `level`, `timestamp`, `context`, `correlationId`, dan `message`) secara otomatis.
*   **Log Kejadian Keamanan**: Wajib mencatat kejadian-kejadian keamanan kritis ke dalam log:
    *   Percobaan login gagal (beserta IP dan email yang dicoba).
    *   Percobaan akses endpoint yang dilindungi tanpa otorisasi (401/403).
    *   Perubahan data sensitif (update email, reset password, perubahan role).

---

## 5. Prisma ORM & Database Management

### A. Standar ORM: Prisma
*   **Prisma Client Instance**: Gunakan Prisma Client yang dideklarasikan sebagai singleton service (`PrismaService`) yang di-inject di dalam module yang membutuhkan akses database.
*   **Database Migrations**:
    *   **Dilarang Keras** melakukan modifikasi struktur database (tabel, kolom, tipe data, indeks) secara langsung menggunakan UI database manager (seperti pgAdmin, DBeaver) atau SQL mentah manual pada database server.
    *   **Wajib** menggunakan **Prisma Migrate** untuk mengelola perubahan skema.
        *   Lingkungan Dev: Jalankan `npx prisma migrate dev` untuk mencatat migrasi baru ke dalam file migrasi berbasis timestamp di Git.
        *   Lingkungan Deployment/Production: Jalankan `npx prisma migrate deploy` secara otomatis saat proses deployment CI/CD (sebelum server menyala) untuk mengeksekusi migrasi yang belum berjalan.
*   **Database Seeding**:
    *   Setiap proyek wajib menyediakan berkas seeding di `prisma/seed.ts`.
    *   Script seeding harus berisi dummy data dasar dan data master yang dibutuhkan aplikasi untuk dijalankan di lingkungan lokal, dan dijalankan dengan perintah `npx prisma db seed`.

### B. Integritas Data & Desain Skema
*   **Database Transactions**:
    *   **Wajib** menggunakan metode **Prisma Transactions** (`prisma.$transaction([ ... ])` atau sequential transaction `$transaction(async (tx) => { ... })`) untuk setiap operasi penulisan (*write/update/delete*) berurutan yang saling bergantung guna menjamin integritas data (ACID).
*   **Pola Soft Delete**:
    *   Untuk tabel data utama yang penting (seperti `users`, `orders`, `transactions`), **dilarang** menggunakan penghapusan fisik (`delete`).
    *   Gunakan pola **Soft Delete** dengan menambahkan kolom opsional `deletedAt DateTime?` pada skema Prisma.
    *   Setiap query query pembacaan (`findMany`, `findFirst`, dll.) wajib menyaring data aktif secara eksplisit: `where: { deletedAt: null }` (atau memanfaatkan prisma middleware/extension untuk menyaring secara otomatis).
*   **Raw Query Prevention**:
    *   Hindari penulisan SQL mentah (`$queryRaw` atau `$executeRaw`). Gunakan API standar Prisma Client.
    *   Jika SQL mentah terpaksa digunakan untuk kebutuhan optimasi query yang sangat kompleks, **wajib** menggunakan parameterized queries (misal: `prisma.$queryRaw` dengan template literals bawaan) untuk menghindari SQL Injection.

### C. Optimasi Performa Query Prisma
*   **N+1 Query Prevention**: Hindari melakukan loop query database di dalam Javascript/Typescript. Ambil data beserta relasinya dalam satu waktu menggunakan blok `include` atau gunakan Prisma DataLoader pattern.
*   **Select Fields Explicitly**: Jangan mengambil seluruh kolom tabel jika hanya membutuhkan beberapa kolom saja. Selalu gunakan properti `select` untuk membatasi kolom yang ditarik dari database, terutama untuk tabel yang memiliki kolom teks panjang (seperti konten artikel, data JSON besar).
*   **Indexing**: Wajib mendefinisikan index pada skema Prisma (`@@index` atau `@unique`) untuk kolom-kolom yang sering dicari dalam filter `where` atau digunakan untuk pengurutan `orderBy`.

### D. Asynchronous Queues & Background Jobs
*   **NestJS Bull/BullMQ**: Untuk proses yang membutuhkan waktu lama (seperti pengiriman email, pembuatan file PDF, sinkronisasi data pihak ketiga), kirim pekerjaan tersebut ke antrean (Queue) agar request HTTP client dapat segera diselesaikan tanpa menunggu proses selesai.
*   **Retry & Backoff**: Konfigurasi strategi *retry* otomatis pada setiap job Queue dengan *exponential backoff* agar job yang gagal tidak langsung dibuang.
*   **Dead Letter Queue (DLQ)**: Pindahkan job yang sudah melampaui batas percobaan ulang ke dalam DLQ khusus untuk diinspeksi manual tanpa menghalangi job lain di antrean utama.

### E. Caching
*   **Cache Manager**: Implementasikan caching menggunakan `@nestjs/cache-manager` (terhubung ke Redis di production) untuk endpoint GET yang mengembalikan data yang jarang berubah (seperti daftar kategori, metadata aplikasi, konfigurasi statis).
*   **Cache Invalidation (Wajib)**:
    *   **Setiap operasi mutasi** (`create`, `update`, `delete`) pada suatu resource **wajib** menghapus cache key terkait resource tersebut. Jangan pernah menambahkan cache di endpoint GET tanpa memastikan ada mekanisme invalidasi di endpoint mutasi yang bersangkutan.
    *   **TTL sebagai Safety Net**: Setiap cache entry **wajib** memiliki TTL (*Time-To-Live*) yang eksplisit (misal: 5 menit untuk data list, 1 jam untuk konfigurasi statis). Dilarang menyimpan cache tanpa batas waktu karena data basi tidak akan pernah terhapus jika invalidasi manual terlewat.
    *   Gunakan pola penamaan cache key yang konsisten dan terprediksi (misal: `users:list`, `users:detail:{id}`) agar mudah dihapus secara tepat saat data berubah.

### F. Zero-Downtime Database Migrations (Expand and Contract Pattern)
*   **Dilarang Melakukan Breaking Migrations Langsung**: Jangan pernah menghapus kolom, mengubah nama kolom, atau menambahkan kolom `NOT NULL` tanpa default value dalam satu file migrasi jika aplikasi di-deploy secara bertahap (Blue-Green atau Rolling Update). Versi aplikasi lama yang masih berjalan selama masa transisi akan langsung crash saat berinteraksi dengan database.
*   **Wajib Menggunakan Pola Expand and Contract (3 Fase)**:
    *   **Fase 1: Expand (Rilis database baru + Dukungan Ganda di Kode)**:
        *   Tulis migrasi database untuk menambahkan kolom baru (wajib opsional/nullable).
        *   Perbarui kode aplikasi untuk menulis data ke kolom lama dan kolom baru secara bersamaan (*dual write*), namun pembacaan data tetap menggunakan kolom lama. Deploy perubahan kode ini ke server.
    *   **Fase 2: Transition (Migrasi Data Historis + Ubah Pembacaan)**:
        *   Jalankan background script/job untuk menyalin seluruh data historis dari kolom lama ke kolom baru.
        *   Perbarui kode aplikasi agar membaca dari kolom baru. Deploy ke server.
    *   **Fase 3: Contract (Pembersihan)**:
        *   Tulis migrasi database baru untuk menghapus kolom lama.
        *   Hapus logika penulisan ganda (*dual write*) dari kode aplikasi (hanya menulis ke kolom baru). Deploy ke server.

---

## 6. Testing & Quality Assurance

### A. Unit Testing (`.spec.ts`)
*   **Mock External Resources**:
    *   Unit test wajib berjalan cepat dan sepenuhnya terisolasi.
    *   **Dilarang** membiarkan unit test menembak database asli, Redis, atau API luar. Wajib mem-mock seluruh repositori, database client, dan eksternal service menggunakan framework mocking NestJS.
    *   **Wajib Mock Prisma dan External Services**: Setiap berkas unit test (`*.spec.ts`) **wajib** mem-mock `PrismaService` dan seluruh service eksternal yang di-inject (seperti Redis/Cache, `UploadService`/S3, BullMQ Queue/Processor, MailService). Tidak boleh ada koneksi fisik/jaringan ke database, Redis, S3, atau antrean (Queue) dalam unit test.

### B. End-to-End Testing (`.e2e-spec.ts`)
*   **Dedicated Test Database**:
    *   Pengujian E2E wajib menggunakan basis data pengujian (Test Database) khusus yang terpisah sepenuhnya dari database pengembangan (development) maupun produksi.
    *   Gunakan library `supertest` untuk memicu HTTP request ke server test secara programatis dan verifikasi respon secara menyeluruh.

---

## 7. Observability & Logging

### A. Correlation ID / Request ID
*   **Wajib mengimplementasikan Correlation ID** pada setiap HTTP request yang masuk menggunakan middleware terpusat. Correlation ID ini harus:
    *   Dibaca dari header request yang datang (misal: `X-Request-ID` atau `X-Correlation-ID`) jika sudah ada (dikirim oleh API Gateway atau klien).
    *   Di-generate baru (menggunakan `crypto.randomUUID()`) jika header tersebut tidak ada.
    *   **Disertakan di setiap baris log** yang dihasilkan selama pemrosesan request tersebut menggunakan `AsyncLocalStorage` atau NestJS `CLS (Continuation Local Storage)`.
    *   **Dikembalikan ke klien** sebagai response header `X-Request-ID` untuk memudahkan debugging dari sisi klien.
*   **Tujuan**: Dengan Correlation ID, satu request yang melewati banyak service atau antrean (Queue) dapat dilacak secara end-to-end di sistem log produksi (Datadog, Grafana, CloudWatch).

### B. Log Level & Error Tracking
*   **Log Levels**: Gunakan log level yang tepat secara disiplin:
    *   `error`: Kegagalan yang memerlukan perhatian segera (exception tidak tertangani, DB mati).
    *   `warn`: Kondisi tidak normal namun tidak mematikan aplikasi.
    *   `log`/`info`: Informasi alur bisnis penting (user berhasil login, pesanan dibuat).
    *   `debug`: Detail teknis yang hanya dibutuhkan saat pengembangan (query yang dieksekusi, payload yang diterima). **Nonaktifkan di production.**
*   **Error Tracking**: Integrasikan **Sentry** (atau platform serupa) untuk menangkap dan melaporkan unhandled exceptions beserta stack trace secara otomatis ke dashboard monitoring.

---

## 8. File Upload Strategy

*   **Validasi Ketat Sebelum Menyimpan**:
    *   **Tipe MIME**: Wajib memvalidasi tipe MIME file berdasarkan isi file (*magic bytes*), bukan hanya dari ekstensi nama file. Gunakan library seperti `file-type` untuk validasi ini.
    *   **Batas Ukuran**: Tetapkan batas ukuran file secara eksplisit di konfigurasi `multer`. Tolak file yang melampaui batas tersebut sebelum disimpan.
*   **Jangan Simpan di Disk Server (Stateless Upload)**:
    *   **Dilarang** menyimpan file hasil upload ke dalam disk filesystem server (misal: folder `./uploads`). File tersebut akan hilang saat kontainer di-restart atau di-scale, dan tidak bisa diakses oleh instance server lain.
    *   **Wajib** menggunakan **Object Storage** (seperti AWS S3, Google Cloud Storage, Cloudflare R2) sebagai destinasi penyimpanan permanen.
    *   **Dilarang** menggunakan Multer disk storage (menyimpan ke disk lokal sementara). Seluruh proses upload wajib menggunakan memory storage (buffer) dan diteruskan langsung ke Object Storage (S3) menggunakan `UploadService`.
*   **Signed URLs untuk Akses Aman**:
    *   Jangan pernah mempublikasikan file yang bersifat privat (seperti dokumen pengguna, struk pembayaran) secara langsung ke internet tanpa autentikasi.
    *   Gunakan **Pre-signed URLs** (URL yang berlaku sementara) yang dibuat oleh backend untuk memberikan akses baca terbatas waktu ke klien yang telah terautentikasi.

---

## 9. Scalability & Resilience

### A. Stateless Application Design
*   **Prinsip Stateless**: Setiap instance NestJS harus sepenuhnya *stateless* — tidak boleh menyimpan state sesi, data user, atau cache lokal di dalam memori proses Node.js yang spesifik satu instance.
*   **Shared State via External Store**: Segala bentuk state bersama (session, lock, cache) **wajib** disimpan di shared store eksternal (Redis) agar dapat diakses oleh semua instance secara konsisten ketika di-scale secara horizontal.

### B. Idempotency untuk Operasi Kritis
*   **Idempotency Key**: Untuk operasi yang tidak boleh dieksekusi lebih dari satu kali (seperti pembuatan transaksi pembayaran, pengiriman email konfirmasi, penerbitan tiket), implementasikan mekanisme **Idempotency Key**.
    *   Klien mengirimkan header `Idempotency-Key: <unique-uuid>` bersama setiap request.
    *   Backend menyimpan hasil eksekusi pertama di Redis dengan key tersebut selama TTL tertentu (misal: 24 jam).
    *   Jika request yang sama datang kembali (retry dari klien), backend mengembalikan hasil tersimpan tanpa mengeksekusi ulang logika bisnis.

### C. Pagination Standar
*   **Cursor-based Pagination**: Gunakan paginasi berbasis kursor untuk tabel data berukuran besar yang sering diperbarui (transaksi, notifikasi, feed aktivitas). Lebih konsisten dan performatif daripada offset pagination pada tabel besar.
*   **Offset Pagination**: Hanya boleh digunakan untuk data konfigurasi atau admin panel yang ukurannya relatif kecil dan jarang berubah.
*   **Konsisten di Seluruh Endpoint**: Setiap endpoint list wajib menggunakan pola response pagination yang seragam:
    ```typescript
    interface PaginatedResponse<T> {
      data: T[];
      meta: {
        total: number;
        page: number;
        limit: number;
        nextCursor?: string;
      };
    }
    ```

### D. Optimistic Concurrency Control
*   **Mencegah Data Saling Menimpa**: Saat dua pengguna (atau proses) mengedit resource yang sama secara bersamaan, tanpa mekanisme kontrol, hasil penulisan terakhir akan menimpa penulisan sebelumnya tanpa peringatan (*last-write-wins*).
*   **Gunakan Field `updatedAt` sebagai Version Guard**: Sertakan field `updatedAt` di dalam body request update. Sebelum menyimpan perubahan, periksa apakah `updatedAt` yang dikirim klien masih cocok dengan nilai di database. Jika tidak cocok, tolak permintaan dengan `409 Conflict`:
    ```typescript
    const current = await prisma.product.findUnique({ where: { id } });
    if (current.updatedAt.getTime() !== dto.updatedAt.getTime()) {
      throw new ConflictException('Data telah diperbarui oleh pengguna lain. Muat ulang dan coba lagi.');
    }
    await prisma.product.update({ where: { id }, data: { ...dto } });
    ```
*   **Kapan Digunakan**: Wajib untuk resource yang kemungkinan besar diedit oleh lebih dari satu pengguna secara bersamaan (produk, artikel, konfigurasi tim, tiket). Tidak wajib untuk resource yang hanya diedit oleh pemiliknya sendiri (profil pribadi).

---

## 10. API Documentation

*   **Swagger / OpenAPI**: Wajib mengintegrasikan `@nestjs/swagger` dan mendefinisikan dokumentasi API menggunakan decorator (`@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiProperty`) langsung di dalam Controller dan DTO.
*   **Lingkungan Aktif**: Aktifkan Swagger UI hanya di lingkungan **development** dan **staging**. **Nonaktifkan di production** untuk mencegah eksposi detail API kepada publik.
*   **Response DTO**: Setiap properti pada DTO respons wajib didokumentasikan menggunakan `@ApiProperty()` disertai contoh nilai (`example`) dan deskripsi singkat.
*   **Standar Dekorasi Kode (Wajib Diikuti Oleh AI):**
    *   **Level Class Controller**:
        *   Wajib menyertakan `@ApiTags('Nama Kategori/Modul')` untuk pengelompokan.
        *   Wajib ditandai dengan `@ApiBearerAuth()` jika controller atau rute di dalamnya menggunakan `JwtAuthGuard`.
    *   **Level Method Controller**:
        *   Wajib menyertakan `@ApiOperation({ summary: 'Ringkasan aksi', description: 'Detail penjelasan alur kerja jika diperlukan' })`.
        *   Wajib mendefinisikan respon sukses dengan decorator spesifik seperti `@ApiOkResponse({ description: '...' })` atau `@ApiCreatedResponse({ description: '...' })`.
        *   Wajib mendefinisikan respon kesalahan standar yang mungkin dilempar (contoh: `@ApiBadRequestResponse()`, `@ApiUnauthorizedResponse()`, `@ApiForbiddenResponse()`, `@ApiNotFoundResponse()`).
    *   **Level Properti DTO**:
        *   Gunakan `@ApiProperty({ example: '...', description: '...' })` untuk properti wajib.
        *   Gunakan `@ApiPropertyOptional({ example: '...', description: '...' })` untuk properti opsional.
        *   Wajib melampirkan properti `enum` (contoh: `enum: UserStatus`) pada kolom yang merupakan tipe enum agar Swagger UI merender dropdown pilihan secara otomatis.

---

## 11. Production Readiness & Monitoring

*   **Graceful Shutdown**:
    *   Wajib mengaktifkan shutdown hooks pada berkas `main.ts` dengan memanggil `app.enableShutdownHooks()`.
    *   Hal ini memastikan aplikasi menyelesaikan semua HTTP request yang sedang berjalan (*in-flight requests*) dan menutup koneksi DB/Redis dengan rapi sebelum sistem operasi (seperti Kubernetes atau Docker) mematikan kontainer.
*   **Health Checks & Probes**:
    *   Wajib mengintegrasikan `@nestjs/terminus` dan membuat endpoint `/health` untuk kebutuhan Liveness dan Readiness Probe di Docker/Kubernetes.
    *   Pantau kesehatan koneksi database, sisa kapasitas storage, dan status memori pada endpoint tersebut.
*   **Response Compression**:
    *   Aktifkan kompresi response HTTP menggunakan middleware `compression` untuk memperkecil ukuran payload yang dikirimkan ke klien dan mengurangi penggunaan bandwidth di production.
*   **Security Headers Audit**:
    *   Lakukan audit berkala terhadap security headers menggunakan tools seperti [securityheaders.com](https://securityheaders.com) untuk memastikan konfigurasi Helmet berjalan dengan benar di production.

---

## 12. Reverse Proxy & Infrastructure

### A. Trust Proxy
*   **Aktifkan Trust Proxy di NestJS**: Jika aplikasi di-deploy di belakang reverse proxy (Nginx, Traefik, AWS ALB, Cloudflare), wajib mengaktifkan pengaturan `trust proxy` pada Express instance:
    ```typescript
    // main.ts
    const app = await NestFactory.create(AppModule);
    app.set('trust proxy', 1); // Percayai proxy pertama (hop pertama)
    ```
    Tanpa pengaturan ini, fitur Rate Limiter (`@nestjs/throttler`) akan salah membaca IP pengguna (selalu membaca IP internal proxy), sehingga semua pengguna akan terkena rate limit yang sama.
*   **Validasi Header yang Di-forward**: Berhati-hati dengan header `X-Forwarded-For` yang bisa dipalsukan oleh klien jika `trust proxy` dikonfigurasi terlalu longgar. Konfigurasi `trust proxy` hanya untuk jumlah proxy hop yang sesuai dengan infrastruktur Anda.

### B. Database Connection Pool
*   **Konfigurasi Pool Size Eksplisit**: Jangan biarkan Prisma menggunakan ukuran connection pool default karena bisa menyebabkan error `connection pool timeout` di production saat traffic tinggi.
    *   Tambahkan parameter `connection_limit` dan `pool_timeout` ke dalam `DATABASE_URL`:
        ```
        DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20"
        ```
    *   **Rumus Rekomendasi**: `connection_limit = (jumlah_cpu_db_server * 2) / jumlah_instance_app`. Mulai dari `5-10` per instance dan sesuaikan berdasarkan hasil pengujian beban.
*   **Hindari Connection Leak**: Pastikan `PrismaService` hanya diinstansiasi sekali (singleton) di seluruh aplikasi. Jangan pernah membuat instance `PrismaClient` baru di luar `PrismaService`.

---

## 13. Dependency Security & Supply Chain

*   **Vulnerability Scanning Rutin**:
    *   Jalankan `npm audit` atau `pnpm audit` secara rutin (minimal satu kali per sprint) untuk memindai seluruh dependency yang terinstal dari CVE (Common Vulnerabilities and Exposures) yang sudah diketahui.
    *   Integrasikan pemindaian ini ke dalam pipeline CI/CD sehingga build gagal otomatis jika terdapat kerentanan tingkat **high** atau **critical**.
*   **Automated Dependency Updates**: Aktifkan **Dependabot** (GitHub) atau **Renovate Bot** untuk mendapatkan Pull Request otomatis saat ada pembaruan versi library yang mengandung patch keamanan.
*   **Lock File Integrity**: Selalu commit `package-lock.json` atau `pnpm-lock.yaml` ke dalam repositori Git untuk memastikan semua developer dan CI/CD server menginstal dependency dengan versi yang persis sama (reproducible builds).
*   **Pinned Versions**: Hindari penggunaan wildcard versi (`^`, `~`) untuk dependency produksi yang kritis. Pertimbangkan menggunakan versi eksak (exact version pinning) untuk package kunci seperti ORM, auth library, dan payment SDK.

---

## 14. Performance & Execution Speed

### A. Concurrent Execution (`Promise.all` vs Sequential `await`)
*   **Hindari Sequential Await Abuse**: Jika terdapat beberapa operasi asinkronus (query database, request HTTP, pembacaan cache, dll.) yang tidak saling bergantung satu sama lain, **dilarang** menggunakan `await` secara berurutan. Hal ini akan memperlambat respon karena setiap operasi harus menunggu operasi sebelumnya selesai (sequential block).
*   **Wajib Menggunakan `Promise.all`**: Gabungkan operasi-operasi independen tersebut ke dalam `Promise.all` agar dapat dieksekusi secara paralel di event loop Node.js.
    *   ❌ **Salah**:
        ```typescript
        const user = await this.userService.findById(userId); // 100ms
        const products = await this.productService.getRecommendations(); // 150ms
        const cart = await this.cartService.getCart(userId); // 80ms
        // Total waktu eksekusi: 330ms (sekuensial)
        ```
    *   ✔️ **Benar**:
        ```typescript
        const [user, products, cart] = await Promise.all([
          this.userService.findById(userId),
          this.productService.getRecommendations(),
          this.cartService.getCart(userId),
        ]);
        // Total waktu eksekusi: max(100, 150, 80) = ~150ms (paralel)
        ```
*   **Penanganan Error & Kejadian Sebagian**:
    *   Gunakan `Promise.all()` jika kegagalan salah satu operasi berarti kegagalan seluruh proses (fail-fast).
    *   Gunakan `Promise.allSettled()` jika ingin semua operasi tetap berjalan sampai selesai meskipun ada beberapa yang gagal, lalu validasi status setiap promise secara manual sebelum memproses hasilnya.

### B. HTTP Keep-Alive untuk Panggilan Layanan Eksternal (Microservices / External API)
*   **TCP Connection Reuse**: Secara bawaan, HTTP/HTTPS agent Node.js mematikan koneksi setelah sebuah request HTTP selesai (`keepAlive: false`). Ini membuat setiap request outbound ke layanan eksternal (seperti payment gateway, AWS S3, email provider, microservice lain) harus memulai ulang jabat tangan TCP dan negosiasi TLS (handshake) yang memakan waktu latensi tambahan 100ms - 300ms.
*   **Wajib Mengaktifkan HTTP Keep-Alive**:
    *   Bila menggunakan `@nestjs/axios` (Axios), pastikan untuk mendefinisikan custom agent dengan `keepAlive: true` saat mendaftarkan `HttpModule`:
        ```typescript
        import * as http from 'http';
        import * as https from 'https';

        @Module({
          imports: [
            HttpModule.register({
              timeout: 5000,
              maxRedirects: 5,
              httpAgent: new http.Agent({ keepAlive: true, keepAliveMsecs: 1000 }),
              httpsAgent: new https.Agent({ keepAlive: true, keepAliveMsecs: 1000 }),
            }),
          ],
        })
        export class ClientModule {}
        ```
    *   Jika menggunakan Native Fetch API atau library client lainnya, pastikan client di-configure untuk menggunakan agent global dengan status keep-alive aktif.


