FROM python:3.10-slim

WORKDIR /app

# Configure python environment
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Install dependencies first for Docker layer caching
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code and runtime data
COPY app/ ./app/
COPY data/ ./data/

EXPOSE 8000

# Run FastAPI using uvicorn with dynamic PORT support for Render
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
