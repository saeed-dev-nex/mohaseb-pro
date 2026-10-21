# Mohaseb Pro — single-container image for Hugging Face Spaces (Docker SDK).
#
# One Daphne process serves the API, the chat WebSocket, the built frontend
# and the uploaded media on port 7860 (the Spaces default app_port).
# Build context is the repository root (in the Space repository).

# ---- Stage 1: build the frontend -------------------------------------------
FROM node:20-alpine AS frontend-build

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
# Same-origin API base: in the Space the browser only talks to one origin
# (the public build would otherwise point at <host>:8000).
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
    DJANGO_ALLOWED_HOSTS=.hf.space,localhost,127.0.0.1 \
    PORT=7860

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
# core.settings expects the build at <repo-root>/frontend/dist.
COPY --from=frontend-build /build/dist ./frontend/dist
COPY deploy/huggingface/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh \
    && mkdir -p /app/data/media \
    && adduser --disabled-password --uid 1000 user \
    && chown -R user:user /app

USER user
EXPOSE 7860

ENTRYPOINT ["/app/entrypoint.sh"]
