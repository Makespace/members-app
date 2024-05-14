# BASE
FROM node:18-slim@sha256:f2e7a19c91d98b854c226c04c4a1bf7d9d5fac28f320777efe5e01aa2e70c474 as node
WORKDIR /app
COPY package.json ./

FROM oven/bun:1 as bun
WORKDIR /app
COPY package.json ./
COPY bun.lockb ./

# DEV
FROM bun as dev-deps
RUN bun install --frozen-lockfile

FROM node as dev
COPY --from=dev-deps /app/node_modules/ node_modules/
COPY ./tsconfig.json .
CMD [ "npx", "tsx", "watch", "./src/index.ts" ]

# PROD
FROM bun as prod-deps
RUN bun install --frozen-lockfile --production

FROM dev as prod-build
COPY ./src src/
RUN npx tsc

FROM node as prod
COPY --from=prod-deps /app/node_modules node_modules/
COPY --from=prod-build /app/build/ build/
COPY ./src/static build/src/static/
RUN ls -l
CMD ["node", "build/src/index.js"]