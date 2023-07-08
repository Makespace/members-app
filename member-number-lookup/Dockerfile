# BASE
FROM node:18-alpine@sha256:bf6c61feabc1a1bd565065016abe77fa378500ec75efa67f5b04e5e5c4d447cd as node
WORKDIR /app
COPY package*.json ./

# DEV
FROM node as dev
RUN npm ci
COPY ./tsconfig.json .
CMD [ "npx", "ts-node-dev", "--transpile-only", "./src/index.ts" ]

# PROD
FROM node as prod-npm
RUN npm ci --production

FROM dev as prod-build
COPY ./src src/
RUN npx tsc

FROM prod-npm as prod
COPY --from=prod-build /app/build/ build/
COPY ./src/static build/src/static/
CMD ["node", "build/src/index.js"]