FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

FROM node:22-alpine AS runtime
# Claude Code CLI answers /ai (auth: CLAUDE_CODE_OAUTH_TOKEN); skills load from .claude/skills
RUN npm i -g @anthropic-ai/claude-code
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

# tsc only compiles .ts → .js. config/ and .claude/skills/ are runtime data, not in dist/.
COPY config ./config
COPY .claude ./.claude
EXPOSE 3000
CMD ["node", "dist/index.js"]
