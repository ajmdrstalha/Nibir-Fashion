FROM node:24-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json .npmrc ./
COPY lib ./lib
COPY artifacts/nibir-fashion ./artifacts/nibir-fashion
COPY artifacts/api-server/package.json ./artifacts/api-server/package.json
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/package.json
COPY artifacts/desktop-shell/package.json ./artifacts/desktop-shell/package.json
COPY scripts/package.json ./scripts/package.json
COPY attached_assets ./attached_assets

RUN pnpm install --frozen-lockfile --ignore-scripts

ARG VITE_API_BASE_URL=http://98.70.41.172:12501

ENV NODE_ENV=development
ENV PORT=12500
ENV API_TARGET=http://backend:12501
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

EXPOSE 12500

WORKDIR /app/artifacts/nibir-fashion

CMD ["node", "./node_modules/vite/bin/vite.js", "--config", "vite.config.ts", "--host", "0.0.0.0"]
