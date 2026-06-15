# NestJS Backend Starterkit

A production-ready, highly secure, and modular backend starterkit built on top of **NestJS** and **TypeScript**. Designed for high performance, type-safety, and ease of scalability.

---

## ⚡ Core Features

- **Robust Authentication & Session Management**:
  - Stateless JWT token-based auth.
  - Secure refresh token rotation using cookie-based session management (`SameSite=Strict`, `HttpOnly`).
  - Mitigated CPU-intensive DoS vectors via split-token indexing lookups.
- **Dynamic Role-Based Access Control (RBAC)**:
  - Custom `@Permissions` decorator and `PermissionsGuard` to evaluate privileges dynamically.
  - Separate `users`, `roles`, and `permissions` relational tables.
- **High-Performance Caching**:
  - Redis integration (`cache-manager-redis-yet`) to cache active sessions and user permissions.
  - Cache invalidation flow upon user mutations (logout, password change, status update, account deletion).
- **Asynchronous Background Queues**:
  - Out-of-the-box BullMQ setup with Redis connection.
  - Interactive queues monitoring dashboard via **Bull Board** at `/queues` (secured for `super_admin` only).
- **Stateless File Storage**:
  - Direct S3/MinIO Object Storage upload utilizing standard streaming.
  - Advanced Magic Bytes (file signature) validation via `file-type` to detect spoofed MIME types.
- **Enterprise Boilerplate Modules**:
  - **OAuth2 (Social Auth)**: Login via Google and GitHub with automatic email-based account linking.
  - **Outbound Webhooks**: User-configurable webhook subscriptions with HMAC signature verification and delivery logs.
  - **Billing & Payments**: Integrated Stripe and Midtrans SDKs and webhook receivers.
  - **Notification Engine**: Stream alerts using JWT-authenticated WebSockets and FCM push notifications.
  - **Developer API Keys**: Generate SHA-256 hashed API Keys with custom scopes and Redis rate-limiting.
  - **Async Excel/CSV Export**: Generate large data spreadsheets in background workers and upload to S3.
  - **Hybrid Feature Flags**: Dynamic runtime overrides via Redis and static fallback via `.env` using `@FeatureFlag` and global `FeatureFlagGuard`.
- **Observability & Health Checks**:
  - Pino Logging (`nestjs-pino`, `pino-pretty`) for high-throughput, structured logs.
  - Global `x-request-id` tracking header attached to every incoming request.
  - `/health` endpoint to monitor CPU heap memory, storage disk, and PostgreSQL connection.
- **Developer Experience & Tooling**:
  - Prisma ORM for type-safe database queries.
  - Fail-fast environment variable validation using Zod schemas at application startup.
  - ESLint and Prettier configured for style checks.

---

## 🛠️ Technology Stack

- **Framework**: [NestJS](https://nestjs.com/) (v11)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Prisma](https://www.prisma.io/) (v6)
- **Cache & Queue Broker**: [Redis](https://redis.io/)
- **Queueing Engine**: [BullMQ](https://docs.bullmq.io/)
- **API Documentation**: [Swagger OpenAPI](https://swagger.io/) & Interactive Docs (`src/docs/index.html`)

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v20+ recommended)
- [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) & Docker Compose

### Step 1: Install Dependencies
```bash
pnpm install
```

### Step 2: Configure Environment Variables
Copy the env template and adjust the variables to fit your configuration:
```bash
cp .env.example .env
```

### Step 3: Run Infrastructure Services
Start the local PostgreSQL, Redis, and MinIO S3 services via Docker Compose:
```bash
docker compose up -d
```

### Step 4: Run Migrations and Seed Database
Sync your database schema with the latest migration, then seed default roles, permissions, and initial admin credentials:
```bash
pnpm db:migrate
pnpm db:seed
```

### Step 5: Start Development Server
```bash
pnpm start:dev
```
The application will boot and be accessible at `http://localhost:4000/api/v1`.

---

## 🧪 Running Tests

### Unit Tests
Verify service logic, cache methods, and upload functionality:
```bash
pnpm run test
```

### End-to-End (E2E) Tests
Verify API controllers, response formatting, and route guards using the sandbox database:
```bash
pnpm run test:e2e
```

---

## 📦 Enterprise Modules Details

This starterkit comes packed with production-ready enterprise modules:

### 1. OAuth2 Social Auth
Provides seamless Google and GitHub authentication out of the box.
- **Google Initiator**: `GET /api/v1/auth/oauth/google`
- **GitHub Initiator**: `GET /api/v1/auth/oauth/github`
- **Behavior**: Auto-links social accounts sharing the same email to local users, or auto-registers a new active user if they don't exist.

### 2. Outbound Webhooks & Event Dispatcher
Deliver system event payloads (e.g. `user.created`) to external client URLs.
- **Subscription CRUD**: `/api/v1/webhooks/subscriptions`
- **Security**: Computes and includes an HMAC SHA-256 signature in the `X-Webhook-Signature` header.
- **Worker**: Processes HTTP POST requests via BullMQ with automatic exponential backoff retry and records logs to `WebhookDeliveryLog`.

### 3. Billing & Payments Boilerplate
Handle subscriptions and checkouts using Stripe and Midtrans.
- **Checkout API**: `POST /api/v1/billing/checkout`
- **Webhooks Receivers**: `POST /api/v1/billing/webhooks/stripe` & `POST /api/v1/billing/webhooks/midtrans`
- **Behavior**: Automatically processes payment events to manage user membership status.

### 4. Multi-Channel Notification Engine
Manage and dispatch notifications across three channels: WebSockets, Email, and Push notifications.
- **JWT-Authenticated WebSockets**: Connect using namespace `/notifications`.
- **Register Device**: `POST /api/v1/notifications/devices`
- **List / Read**: `GET /api/v1/notifications` & `PATCH /api/v1/notifications/:id/read`
- **Processor**: Asynchronously queues email sends (nodemailer + HTML templates) and logs FCM push triggers.

### 5. Developer API Key Management
Issue and control developer access tokens with strict Redis-based rate limiting.
- **API Key CRUD**: `/api/v1/api-keys`
- **Authentication**: Using `ApiKeyGuard` enforcing `X-API-Key` headers.
- **Security**: API Keys are cryptographically secure and saved in the database using SHA-256 hashes.

### 6. Async Excel/CSV Export
Export large database records to spreadsheets in a memory-safe background worker.
- **Trigger Export**: `POST /api/v1/file-jobs/export`
- **Download**: `/api/v1/file-jobs/:id` (returns S3 pre-signed read URL)
- **Worker**: Compiles spreadsheets using `exceljs` via BullMQ, uploads directly to S3, and triggers WebSocket alerts upon completion.

### 7. Hybrid Feature Flag System
Control the availability of endpoints or entire controllers at runtime.
- **Usage**: Decorate any controller class or individual route handler with `@FeatureFlag('feature_name')`.
- **Static Configuration**: Define `FEATURE_<FEATURE_NAME>=true` or `FEATURE_<FEATURE_NAME>=false` in your `.env` file.
- **Dynamic Overrides**: Set a key in Redis (`feature_flag:<name>` as `true` or `false`) to dynamically toggle features in real-time without restarts.
- **Resilience**: Gracefully falls back to `.env` variables if Redis is offline. If undefined in both, defaults to `true` (enabled).

---

## 📘 Interactive API Documentation

- **Swagger UI**: Access interactive Swagger documentation at `http://localhost:4000/api/v1/docs`.
- **Architecture & Flow Guide**: Access the detailed offline HTML-based architecture guide at `http://localhost:4000/api/v1` or browse [src/docs/index.html](file:///home/beta/workspace/starter-kit/backend-starterkit/apps/api/src/docs/index.html).

---

## 💡 Key CLI Commands

- **Create Super Admin**: Promotes any registered email address to a `super_admin`:
  ```bash
  pnpm db:make-super-admin <user-email>
  ```
- **Reset Database**: Clears PostgreSQL database, reapplies schema migrations, and re-seeds:
  ```bash
  pnpm prisma migrate reset --force
  ```
- **Generate Client**: Rebuilds the Prisma Client type definitions:
  ```bash
  pnpm prisma generate
  ```