FROM node:22-alpine AS build
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG PRISMA_ENGINES_MIRROR=https://npmmirror.com/mirrors/prisma
ENV PRISMA_ENGINES_MIRROR=${PRISMA_ENGINES_MIRROR}
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY manage/package.json ./manage/package.json
COPY backend/package.json ./backend/package.json
RUN npm config set registry ${NPM_REGISTRY} \
    && npm config set fetch-retries 8 \
    && npm config set fetch-retry-mintimeout 10000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm ci --no-audit --no-fund
COPY backend ./backend
RUN npm run prisma:generate -w backend && npm run build -w backend

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
EXPOSE 3000
CMD ["node", "backend/dist/main.js"]
