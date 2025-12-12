FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files
COPY pyproject.toml ./

# Install Python dependencies directly (not editable for Docker)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
    "fastapi[standard]>=0.115.0" \
    "uvicorn[standard]>=0.32.0" \
    "pydantic>=2.10.0" \
    "pydantic-settings>=2.6.0" \
    "surrealdb>=1.0.0" \
    "httpx>=0.27.0" \
    "python-dotenv>=1.0.0" \
    "python-multipart>=0.0.9" \
    "websockets>=14.0" \
    "python-dateutil>=2.8.2"

# Copy application source
COPY src/ ./src/
COPY scripts/ ./scripts/

# Set Python path
ENV PYTHONPATH=/app/src

# Expose port
EXPOSE 8080

# Command will be overridden by docker-compose
CMD ["uvicorn", "aura.main:app", "--host", "0.0.0.0", "--port", "8080"]

