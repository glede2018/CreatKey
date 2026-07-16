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
COPY frontend ./frontend
RUN npm run build -w frontend

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
