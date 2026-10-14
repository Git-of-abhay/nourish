FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY dayora ./dayora
COPY run.py .
ENV DAYORA_DB=/data/dayora.sqlite3
CMD ["sh", "-c", "mkdir -p /data && gunicorn -b 0.0.0.0:${PORT:-10000} -w 1 --threads 4 --timeout 120 'dayora:create_app()'"]
