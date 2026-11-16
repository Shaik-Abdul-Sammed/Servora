# ============================================================================
# Servora Multi-Tenant Platform Containerfile
# High-performance lightweight Node.js runtime
# ============================================================================
FROM node:24-alpine AS base

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl ca-certificates

# Copy package descriptors
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/utils/package.json ./packages/utils/
COPY services/order-service/package.json ./services/order-service/

# Copy source trees
COPY packages/ ./packages/
COPY services/ ./services/
COPY apps/ ./apps/
COPY data/ ./data/

# Environment configuration
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start core order service and web applications
CMD ["node", "--experimental-strip-types", "services/order-service/src/server.ts"]
