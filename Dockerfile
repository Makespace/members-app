# BASE
FROM node:20-slim@sha256:a16301294ba66d2ad22d3beded4a52720f96ab208c1db0973c034d0127a4ccb0 as node
WORKDIR /app
COPY package.json ./
RUN apt-get -y update &&  \ 
    apt-get install --no-install-recommends  \
    -y ca-certificates && \
    rm -rf /var/lib/apt/lists/*

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