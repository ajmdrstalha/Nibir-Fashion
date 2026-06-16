FROM node:24-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json .npmrc ./
COPY lib ./lib
COPY artifacts/api-server ./artifacts/api-server
COPY artifacts/nibir-fashion/package.json ./artifacts/nibir-fashion/package.json
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/package.json
COPY artifacts/desktop-shell/package.json ./artifacts/desktop-shell/package.json
COPY scripts/package.json ./scripts/package.json

RUN pnpm install --frozen-lockfile --ignore-scripts
RUN node artifacts/api-server/build.mjs

ENV NODE_ENV=production
ENV PORT=12501
ENV JWT_SECRET=change-this-local-dev-secret

EXPOSE 12501

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
