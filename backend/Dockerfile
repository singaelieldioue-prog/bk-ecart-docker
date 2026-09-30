# ── Étape build : installe les deps (compile better-sqlite3 si pas de binaire) ──
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev

# ── Étape runtime : image légère ──
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV DB_PATH=/data/data.db
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY scripts ./scripts
RUN mkdir -p /data
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
