# syntax=docker/dockerfile:1
#
# seAMLess web app. `dev` runs the Vite dev server with HMR against the
# bind-mounted source; `prod` produces the static bundle served by nginx.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY vite-project/package.json vite-project/package-lock.json ./
RUN npm ci

# --- development ------------------------------------------------------------
FROM node:22-bookworm-slim AS dev
RUN apt-get update && apt-get install -y --no-install-recommends curl tini \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY vite-project/ ./
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "run", "dev"]

# --- production build -------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY vite-project/ ./
# Vite inlines env vars at build time, so they must be present here.
ARG VITE_API_BASE_URL
ARG VITE_DEV_AUTH
ARG VITE_DEV_USER_EMAIL
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_MEASUREMENT_ID
RUN npm run build

FROM nginx:1.27-alpine AS prod
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
