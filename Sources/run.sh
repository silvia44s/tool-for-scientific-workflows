#!/bin/bash

set -e

echo "Installing frontend dependencies..."
npm install

echo "Setting up backend..."
cd backend

if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

source venv/bin/activate

pip install -r requirements.txt

echo "Starting backend..."
uvicorn workflow_backend.api:app --reload &
BACKEND_PID=$!

cd ..

echo "Starting frontend..."
npm run dev

echo "Stopping backend..."
kill $BACKEND_PID