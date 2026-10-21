# Mohaseb Pro frontend — Vite build served by nginx, which also reverse-proxies
# the API, media files and the chat WebSocket to the backend service.
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Same-origin API base: nginx proxies /api/ to the backend, so the browser
# only ever talks to one origin (cookies and CORS stay simple).
ENV VITE_API_URL=/api/
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
