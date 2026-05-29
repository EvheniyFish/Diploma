# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS deps
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    BACKEND_URL=http://backend:3000 \
    CONTROL_PORT=3001 \
    TICK_INTERVAL_SECONDS=10
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
RUN chown -R node:node /app
USER node
EXPOSE 3001
CMD ["node", "src/index.js"]
