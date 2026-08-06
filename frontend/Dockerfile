# ---------- Dependencies ----------
FROM node:20-alpine AS deps

WORKDIR /app

# No package-lock.json is committed yet — `npm install` it is.
# (If a lockfile is added later, switch to `npm ci` for reproducible builds.)
COPY package.json ./
RUN npm install --no-audit --no-fund

# ---------- Build ----------
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time — the
# backend URL the user's BROWSER must reach (see compose.yaml for the wiring).
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Runs ESLint + type-checking as part of the build (CI parity).
RUN npm run build

# ---------- Runtime ----------
# Next.js `output: 'standalone'` produces a self-contained server (server.js +
# minimal node_modules) — no devDependencies, no source maps.
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Non-root user (standard Next.js convention: uid 1001).
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# If a public/ dir is ever added: COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000 || exit 1

CMD ["node", "server.js"]
