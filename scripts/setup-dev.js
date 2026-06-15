#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for terminal output
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

const log = {
  info: (msg) => console.log(`${COLORS.cyan}[INFO]${COLORS.reset} ${msg}`),
  success: (msg) => console.log(`${COLORS.green}[SUCCESS]${COLORS.reset} ${COLORS.bright}${msg}${COLORS.reset}`),
  warn: (msg) => console.log(`${COLORS.yellow}[WARN]${COLORS.reset} ${msg}`),
  error: (msg) => console.error(`${COLORS.red}[ERROR]${COLORS.reset} ${msg}`),
  step: (msg) => console.log(`\n${COLORS.magenta}==>${COLORS.reset} ${COLORS.bright}${msg}${COLORS.reset}`),
};

console.log(`
${COLORS.cyan}${COLORS.bright}======================================================
     🚀 NESTJS BACKEND STARTERKIT ONBOARDING SETUP 🚀
======================================================${COLORS.reset}
`);

const rootDir = path.resolve(__dirname, '..');

function runCmd(command, stepName) {
  try {
    log.info(`Executing: ${command}`);
    execSync(command, { cwd: rootDir, stdio: 'inherit' });
    return true;
  } catch (error) {
    log.error(`Failed to execute step: ${stepName}`);
    return false;
  }
}

// Step 1: Environment File Setup
log.step('Setting up .env file...');
const envPath = path.join(rootDir, '.env');
const envExamplePath = path.join(rootDir, '.env.example');

if (fs.existsSync(envPath)) {
  log.info('.env file already exists. Skipping copy.');
} else {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    log.success('Created .env from .env.example');
  } else {
    log.error('.env.example not found. Cannot create .env.');
    process.exit(1);
  }
}

// Step 2: Prerequisites Verification
log.step('Checking developer dependencies...');
try {
  const nodeVersion = execSync('node -v').toString().trim();
  log.info(`Node.js version: ${nodeVersion}`);
  
  const pnpmVersion = execSync('pnpm -v').toString().trim();
  log.info(`pnpm version: ${pnpmVersion}`);
} catch (err) {
  log.error('pnpm is not installed. Please install pnpm (npm i -g pnpm) before running setup.');
  process.exit(1);
}

// Step 3: Start Services via Docker Compose
log.step('Booting Docker infrastructure (Postgres, Redis, MinIO)...');
try {
  execSync('docker info', { stdio: 'ignore' });
  const dockerStarted = runCmd('docker compose up -d', 'Docker Compose boot');
  if (dockerStarted) {
    log.success('Docker services are up and running!');
  } else {
    log.warn('Docker compose failed to start. Ensure Docker is running.');
  }
} catch (err) {
  log.warn('Docker daemon is not running. Make sure you run PostgreSQL and Redis manually.');
}

// Step 4: Install Dependencies
log.step('Installing project dependencies...');
if (runCmd('pnpm install', 'Dependency Installation')) {
  log.success('Dependencies installed successfully.');
} else {
  log.error('pnpm install failed.');
  process.exit(1);
}

// Step 5: Database Schema Migration and Generation
log.step('Syncing database schema and generating Prisma client...');
if (runCmd('pnpm db:migrate', 'Prisma Migrate')) {
  log.success('Database migrated successfully.');
} else {
  log.warn('Prisma migrate failed. Retrying migration deploy...');
  if (!runCmd('pnpm db:deploy', 'Prisma Deploy')) {
    log.error('Could not sync database. Ensure PostgreSQL is running on port 5432.');
    process.exit(1);
  }
}

if (runCmd('pnpm db:generate', 'Prisma client generation')) {
  log.success('Prisma client generated.');
}

// Step 6: Database Seeding
log.step('Seeding default roles, permissions, and superadmin...');
if (runCmd('pnpm db:seed', 'Prisma DB Seed')) {
  log.success('Database seeding completed successfully.');
} else {
  log.warn('Database seeding failed or has already been seeded.');
}

// Setup Complete
console.log(`
${COLORS.green}${COLORS.bright}======================================================
  🎉 SETUP COMPLETE - STARTERKIT IS READY TO GO! 🎉
======================================================${COLORS.reset}

Here are your local development links:
- 💻 ${COLORS.bright}Dev API Server:${COLORS.reset} http://localhost:4000/api/v1
- 📚 ${COLORS.bright}Swagger API Docs:${COLORS.reset} http://localhost:4000/api/v1/docs
- 📊 ${COLORS.bright}BullMQ Queue Dashboard:${COLORS.reset} http://localhost:4000/queues (Superadmin only)
- 🗄️ ${COLORS.bright}Database Studio:${COLORS.reset} Run 'pnpm db:studio' to view tables at http://localhost:5555

To start the server in watch/development mode:
${COLORS.cyan}${COLORS.bright}  pnpm start:dev${COLORS.reset}
`);
