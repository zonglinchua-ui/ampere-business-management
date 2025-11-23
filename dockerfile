##############################################
# 1. BASE — installs system dependencies
##############################################
FROM node:20-bookworm AS base
WORKDIR /app

# Speed up yarn by using the stable npm registry
RUN yarn config set registry https://registry.npmjs.org/

##############################################
# 2. DEPENDENCIES LAYER — install node_modules
##############################################
FROM base AS deps

# Required for sharp + Prisma
RUN apt-get update && apt-get install -y \
  openssl \
  libc6 \
  python3 \
  build-essential \
  && rm -rf /var/lib/apt/lists/*

# Copy package files only (cache friendly)
COPY package.json yarn.lock ./

# Install dependencies strictly from yarn.lock
RUN yarn install --frozen-lockfile

##############################################
# 3. BUILDER — build Next.js + generate Prisma
##############################################
FROM base AS builder

# Copy node_modules from deps
COPY --from=deps /app/node_modules ./node_modules

# Copy full app source
COPY . .

# Generate Prisma code (required for build)
RUN npx prisma generate

# Build app
RUN yarn build

##############################################
# 4. RUNNER — minimal image for production
##############################################
FROM node:20-bookworm AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy package.json for next runtime
COPY package.json ./

# Copy built app + node_modules
COPY --from=builder /app/.next ./.next
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3000

CMD ["yarn", "start"]
