# BASE
FROM node:20-slim@sha256:a16301294ba66d2ad22d3beded4a52720f96ab208c1db0973c034d0127a4ccb0 as node
WORKDIR /app
COPY package.json ./
RUN apt-get -y update &&  \ 
    apt-get install --no-install-recommends  \
    -y ca-certificates && \
    rm -rf /var/lib/apt/lists/*

FROM node AS bun
WORKDIR /app
RUN apt-get -y update &&  \ 
    apt-get install --no-install-recommends -y \
    python3 \
    curl \
    unzip \
    &&  rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr bash
COPY package.json ./
COPY bun.lockb ./

# DEV
FROM bun AS dev-deps
RUN bun install --frozen-lockfile

FROM node AS dev
COPY --from=dev-deps /app/node_modules/ node_modules/
COPY ./tsconfig.json .
CMD [ "npx", "tsx", "watch", "./src/index.ts" ]

# PROD
FROM bun AS prod-deps
RUN bun install --frozen-lockfile --production

FROM dev AS prod-build
COPY ./src src/
RUN npx tsc

FROM node AS prod
COPY --from=prod-deps /app/node_modules node_modules/
COPY --from=prod-build /app/build/ build/
COPY ./src/static build/src/static/
COPY ./src/instrument.mjs ./
RUN ls -l
CMD ["node", "--import", "./instrument.mjs", "build/src/index.js"]