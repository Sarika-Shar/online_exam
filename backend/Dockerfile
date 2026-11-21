# Multi-Stage Production Dockerfile for Enterprise Online Examination Backend
# Stage 1: Dependency Installation & Build
FROM node:20-bullseye-slim AS dependencies

WORKDIR /usr/src/app

# Install build dependencies for native modules (canvas, OCR tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Production Runner
FROM node:20-bullseye-slim AS runner

WORKDIR /usr/src/app

# Install runtime dependencies for canvas and PDF parsing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=5000

# Create non-root application user for defense-in-depth security
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs examapp

COPY --from=dependencies --chown=examapp:nodejs /usr/src/app/node_modules ./node_modules
COPY --chown=examapp:nodejs . .

# Ensure uploads directory exists and is writable
RUN mkdir -p uploads && chown -R examapp:nodejs uploads

USER examapp

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "server.js"]
