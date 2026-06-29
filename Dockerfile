# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Production Stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
# Copy public/assets
COPY --from=builder /app/public ./public
# Copy scripts
COPY --from=builder /app/scripts ./scripts
# Copy secrets folder (required for Apple/Google keys)
COPY --from=builder /app/secrets ./secrets

# Set environment to production
ENV NODE_ENV=production

# Expose port (must match your app's port in .env/config)
EXPOSE 5002

# Start the application
CMD ["npm", "start"]
