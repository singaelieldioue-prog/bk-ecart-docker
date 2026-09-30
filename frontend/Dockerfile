# ── Étape build : compile la SPA React avec Vite ──
FROM node:24-bookworm-slim AS build
WORKDIR /app
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build

# ── Étape runtime : nginx sert les fichiers statiques + proxy /api ──
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
