# Dockerfile for AgentSphere Python FastAPI Service
FROM python:3.11-slim AS runner

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY apps/python-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/python-service/ .

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
