
#!/bin/bash

# Ampere Business Management System - Production Build Script
# This script prepares the application for NAS deployment

set -e

echo "🚀 Starting production build for NAS deployment..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker to proceed."
    exit 1
fi

echo "🔍 Building Docker image..."
docker build -t ampere-business-management:latest .

echo "📋 Verifying image size..."
docker images ampere-business-management:latest

echo "🧪 Testing container health..."
docker run --rm -d --name ampere-test -p 3001:3000 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
  -e NEXTAUTH_URL="http://localhost:3001" \
  ampere-business-management:latest

# Wait for container to start
sleep 10

# Test health endpoint
if curl -f http://localhost:3001/api/health >/dev/null 2>&1; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed!"
fi

# Cleanup test container
docker stop ampere-test

echo "💾 Saving Docker image to tar file..."
docker save ampere-business-management:latest | gzip > ampere-business-management-image.tar.gz

echo "📦 Creating deployment package..."
tar -czf ampere-business-management-nas-deployment.tar.gz \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.build' \
    --exclude='*.log' \
    --exclude='*.tar.gz' \
    Dockerfile docker-compose.yml .dockerignore \
    package.json .env DEPLOYMENT.md \
    app components lib prisma scripts public types \
    next.config.js tailwind.config.ts tsconfig.json

echo "🎉 Build complete! Files created:"
echo "  📁 ampere-business-management-nas-deployment.tar.gz (Source code package)"
echo "  🐳 ampere-business-management-image.tar.gz (Docker image)"
echo ""
echo "📖 Next steps:"
echo "  1. Transfer both files to your NAS"
echo "  2. Load the Docker image: docker load < ampere-business-management-image.tar.gz"
echo "  3. Extract source files: tar -xzf ampere-business-management-nas-deployment.tar.gz"
echo "  4. Follow DEPLOYMENT.md instructions"
echo ""
echo "🔧 Quick deployment command:"
echo "  docker-compose up -d"
