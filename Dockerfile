# Use a slim Node.js (LTS) image as base
FROM node:22-slim AS builder

WORKDIR /app

# Install system dependencies and clean up in single layer
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy package files for dependency installation
COPY package*.json ./

# Install node dependencies for builder stage
RUN npm ci --only=production && npm cache clean --force

# Copy application source code
COPY . .

# ----- Production stage -----
FROM node:22-slim

WORKDIR /app

# Copy necessary files from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.js ./
COPY --from=builder /app/ecosystem.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/views ./views
COPY --from=builder /app/routes ./routes
COPY --from=builder /app/services ./services
COPY --from=builder /app/models ./models
COPY --from=builder /app/config ./config

# Install PM2 process manager globally
RUN npm install pm2 -g

# Create a volume for persistent data
VOLUME /app/data

# Configure application port
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Set production environment
ENV NODE_ENV=production

# Run as non-root user (best practice for security)
USER node

# Start application with PM2 with user node
CMD ["pm2-runtime", "ecosystem.config.js"]
