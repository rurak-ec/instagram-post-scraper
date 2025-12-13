# Multi-stage build for optimized image size

# Stage 1: Build
FROM node:20-bookworm-slim AS builder

# Enable Corepack for Yarn Berry support
RUN corepack enable

WORKDIR /app

# Install dependencies for Playwright and Yarn
RUN apt-get update && apt-get install -y \
  python3 \
  make \
  g++ \
  && rm -rf /var/lib/apt/lists/*

# Copy package files (including .yarnrc.yml for Yarn version)
COPY package.json yarn.lock .yarnrc.yml ./

# Install dependencies with Yarn
RUN yarn install --immutable

# Copy source code
COPY . .

# Build application
RUN yarn build

# Stage 2: Production
FROM node:20-bookworm-slim

# Enable Corepack for Yarn Berry support
RUN corepack enable

WORKDIR /app

# Install Chromium, tini (for zombie process reaping), and dependencies
RUN apt-get update && apt-get install -y \
  chromium \
  chromium-driver \
  tini \
  fonts-ipafont-gothic \
  fonts-wqy-zenhei \
  fonts-thai-tlwg \
  fonts-kacst \
  fonts-freefont-ttf \
  libxss1 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Set environment variable for Playwright to use system Chromium
ENV CHROME_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV DOCKER_ENV=true

# Copy package files
COPY package.json yarn.lock .yarnrc.yml ./

# Install production dependencies only with Yarn
RUN yarn install --immutable

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create directories for data and sessions
RUN mkdir -p /app/data /app/sessions

# Note: We run as root inside the container because mounted volumes
# may have different ownership on the host. Docker isolation provides security.

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use tini as init to handle zombie process reaping
ENTRYPOINT ["/usr/bin/tini", "--"]

# Start application
CMD ["node", "dist/main"]
