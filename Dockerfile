# Use Node.js 20 as base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY synditech/backend/package*.json ./
COPY synditech/backend/package-lock.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY synditech/backend/ ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/monitoring/health || exit 1

# Start the application
CMD ["npm", "start"]