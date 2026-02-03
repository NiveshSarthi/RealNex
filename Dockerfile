# Root Dockerfile
# By default, this builds the backend. 
# For full multi-service deployment, use the root docker-compose.yml in Coolify.

FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies for the backend
COPY backend/package*.json ./
RUN npm install --production

# Copy backend source code
COPY backend/ .

# Expose backend port
ENV PORT 3000
EXPOSE 3000

# Start backend
CMD ["npm", "start"]


