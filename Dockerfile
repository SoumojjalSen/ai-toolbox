FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

FROM node:20-alpine AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

# tsc only compiles .ts → .js. config/ and skills/ are runtime data, not in dist/.
COPY config ./config
COPY skills ./skills
EXPOSE 3000
CMD ["node", "dist/index.js"]
