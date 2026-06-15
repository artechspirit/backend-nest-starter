# ==========================================
# Stage 1: Build Stage
# ==========================================
FROM node:20-alpine AS builder

# Install build tools and native dependencies requirements
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package configurations and prisma schema
COPY package.json pnpm-lock.yaml tsconfig.json tsconfig.build.json nest-cli.json prisma.config.ts ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Generate Prisma Client
RUN pnpm prisma generate

# Copy source code files
COPY src ./src

# Build the NestJS application
RUN pnpm run build

# Prune node_modules to keep only production dependencies
RUN pnpm prune --prod

# ==========================================
# Stage 2: Runner Stage
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache libc6-compat

# Set to production environment
ENV NODE_ENV=production

# Copy compiled build and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# Use default non-root user "node" for security best practices
USER node

# Expose port (must match APP_PORT configuration)
EXPOSE 4000

# Start command
CMD ["node", "dist/main.js"]
