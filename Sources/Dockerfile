FROM node:20 AS frontend-build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build


FROM python:3.11-slim
WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend /app/backend
COPY demo_scripts /app/demo_scripts
COPY --from=frontend-build /app/dist /app/dist

RUN chmod +x /app/demo_scripts/*.py || true

EXPOSE 8000

CMD ["bash", "-lc", "cd /app/backend && uvicorn workflow_backend.api:app --host 0.0.0.0 --port 8000"]