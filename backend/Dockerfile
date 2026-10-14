FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY nourish ./nourish
COPY run.py .
CMD ["sh", "-c", "gunicorn -b 0.0.0.0:${PORT:-10000} -w 2 --threads 4 --timeout 120 'nourish:create_app()'"]
