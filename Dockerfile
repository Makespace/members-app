# BASE
FROM node:22-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436 as node
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
RUN curl -fsSL https://bun.sh/install | BUN_INSTALL=/usr bash -s "bun-v1.3.14"
COPY package.json ./
COPY bun.lock ./

# DEV
FROM bun AS dev-deps
RUN bun install --frozen-lockfile

FROM node AS dev
COPY --from=dev-deps /app/node_modules/ node_modules/
COPY ./tsconfig.json .
CMD [ "npx", "tsx", "watch", "./src/index.ts" ]

FROM node AS sync_worker_dev
COPY --from=dev-deps /app/node_modules/ node_modules/
COPY ./tsconfig.json .
CMD [ "npx", "tsx", "watch", "./src/sync-worker/index.ts" ]

# PROD
FROM bun AS prod-deps
RUN bun install --frozen-lockfile --production

FROM dev AS prod-build
COPY ./src src/
RUN npx tsc

FROM bun AS dev_container
RUN apt-get update \
    && apt-get install -y git make \
    && ln -s /workspace/.devcontainer/db /db

FROM node AS prod
COPY --from=prod-deps /app/node_modules node_modules/
COPY --from=prod-build /app/build/ build/
COPY ./src/static build/src/static/
COPY ./src/instrument.mjs ./
COPY ./fly-run.sh ./
CMD ["/bin/bash", "fly-run.sh"]
