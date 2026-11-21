# Production Dockerfile for Enterprise Online Examination Backend (Root Context)
FROM node:20-slim

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci --only=production || npm install --only=production

COPY backend/ .

RUN mkdir -p uploads

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "server.js"]
