# BASE
FROM node:14-alpine@sha256:43ec2ba01c2a245e341489956258afd3535a9ebfdf87ade04b84299ca736607f as node
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
RUN npm run compile

FROM prod-npm as prod
COPY --from=prod-build /app/build/ build/
COPY ./src/static build/src/static/
CMD ["node", "build/src/index.js"]