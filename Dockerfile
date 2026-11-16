FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json vite.config.mjs ./
RUN npm ci
COPY client ./client
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --from=build --chown=node:node /app/client/dist ./client/dist
RUN mkdir -p server/data && chown node:node server/data
USER node
EXPOSE 8080
CMD ["sh", "-c", "node server/seed.mjs && exec node server/index.mjs"]
