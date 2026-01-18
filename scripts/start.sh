#!/bin/bash

# Start Redis in background
echo "🚀 Starting Redis..."
redis-server --daemonize yes

# Wait for Redis to be ready
echo "⏳ Waiting for Redis..."
until redis-cli ping | grep -q PONG; do
  sleep 1
done
echo "✅ Redis is ready!"

# Start App
echo "🚀 Starting NestJS App..."
exec node dist/main
