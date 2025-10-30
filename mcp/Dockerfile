# Hedge Payments MCP Server - Docker Image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm install --production

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript to JavaScript
RUN npm install typescript@^5.3.3 --save-dev && \
    npm run build && \
    npm uninstall typescript

# Remove source files after build
RUN rm -rf src tsconfig.json

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start the server
CMD ["node", "build/index.js"]
