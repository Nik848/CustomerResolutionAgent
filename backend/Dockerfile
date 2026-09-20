FROM node:22-alpine

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy source code and migrations
COPY src/ ./src/
COPY migrations/ ./migrations/

# Default environment configuration
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Start server using production node command
CMD ["node", "src/server.js"]
