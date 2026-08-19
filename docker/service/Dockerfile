# syntax=docker/dockerfile:1
#
# seAMLess API service (:3001). Authenticates the caller with Firebase, then
# proxies to the R compute backend.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY backend/service/package.json backend/service/package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend/service/package.json backend/service/package-lock.json ./
COPY backend/service/tsconfig.json ./
COPY backend/service/src ./src
RUN npx tsc

# --- development: tsc runs on start so bind-mounted src edits take effect ---
FROM node:22-bookworm-slim AS dev
RUN apt-get update && apt-get install -y --no-install-recommends curl tini \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY backend/service/ ./
ENV NODE_ENV=development
EXPOSE 3001
ENTRYPOINT ["/usr/bin/tini", "--"]
# Deliberately not `npm run start`: that script passes debug.config.json as
# argv[2], which is gitignored and absent from a fresh clone. Config comes from
# the environment instead (see loadConfig in src/services/app.ts).
CMD ["sh", "-c", "npx tsc && exec node --enable-source-maps dist/server.js"]

# --- production: prebuilt dist, no toolchain on the start path -------------
FROM node:22-bookworm-slim AS prod
RUN apt-get update && apt-get install -y --no-install-recommends curl tini \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/service/package.json backend/service/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
EXPOSE 3001
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "--enable-source-maps", "dist/server.js"]
