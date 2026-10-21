# Mohaseb Pro — single-container image for Render (free web service).
#
# One Daphne process serves the API, the chat WebSocket, the built
# frontend and the uploaded media on $PORT (Render assigns it).
# Build context is the repository root. The local docker-compose setup
# (backend/ + frontend/ images) is unaffected by this file.

# ---- Stage 1: build the frontend -------------------------------------------
FROM node:20-alpine AS frontend-build

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# Same-origin API base: the browser only talks to the service origin.
ENV VITE_API_URL=/api/
RUN npm run build

# ---- Stage 2: runtime -------------------------------------------------------
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_DEBUG=false \
    DJANGO_SERVE_FRONTEND=true \
    DJANGO_BEHIND_PROXY=true \
    DJANGO_HTTPS=true \
    DJANGO_ALLOWED_HOSTS=.onrender.com,localhost,127.0.0.1

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
# core.settings expects the build at <repo-root>/frontend/dist.
COPY --from=frontend-build /build/dist ./frontend/dist
COPY render-entrypoint.sh /app/render-entrypoint.sh

RUN chmod +x /app/render-entrypoint.sh && mkdir -p /app/data/media

EXPOSE 10000

ENTRYPOINT ["/app/render-entrypoint.sh"]
