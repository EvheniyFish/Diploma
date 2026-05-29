# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS build
WORKDIR /app
ARG VITE_ADMIN_KEY=dev-admin-key
ARG VITE_API_URL=/api/v1
ENV VITE_ADMIN_KEY=$VITE_ADMIN_KEY \
    VITE_API_URL=$VITE_API_URL
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
