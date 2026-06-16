# Stage 1: Build React frontend
FROM node:20-alpine AS frontend
WORKDIR /build
COPY web/package.json web/vite.config.js ./
RUN npm install
COPY web/src ./src
COPY web/index.html ./
RUN npm run build

# Stage 2: Python app + built frontend
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ .
COPY --from=frontend /build/dist ./static
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
