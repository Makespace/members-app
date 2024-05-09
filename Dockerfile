# BASE
FROM node:18-slim@sha256:cbfb3c9830932b7b1c2738abf47c66568fc7b06cf782d803e7ddff52b2fc835d as node
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