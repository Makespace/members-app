# BASE
FROM node:14-alpine@sha256:43ec2ba01c2a245e341489956258afd3535a9ebfdf87ade04b84299ca736607f as node
WORKDIR /app
COPY package*.json ./

# DEV
FROM node as dev
RUN npm install
COPY ./tsconfig.json .
CMD [ "npx", "ts-node-dev", "--transpile-only", "./src/index.ts" ]
