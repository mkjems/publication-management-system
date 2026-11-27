# Build the web app (a static Vite app), then serve it with unprivileged nginx on port 8080.
FROM node:24-alpine AS build

WORKDIR /app
RUN corepack enable

# Manifests first, so the dependency layer is cached until they change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @pms/web build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build --chown=101:101 /app/apps/web/dist /usr/share/nginx/html

EXPOSE 8080
