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