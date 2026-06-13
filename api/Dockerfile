FROM python:3.12-slim

WORKDIR /app

# install deps first so this layer gets cached
# (we only re-install when requirements.txt changes, not on every code edit)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# --host 0.0.0.0 so it's reachable from outside the container
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
