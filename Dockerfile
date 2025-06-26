# Multi-stage build for SafeTube CI environment
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    git \
    curl \
    wget \
    ffmpeg

# Create virtual environment and install yt-dlp
RUN python3 -m venv /opt/yt-dlp-env && \
    . /opt/yt-dlp-env/bin/activate && \
    pip install --no-cache-dir yt-dlp && \
    ln -s /opt/yt-dlp-env/bin/yt-dlp /usr/local/bin/yt-dlp

# Install Yarn (force overwrite if it exists)
RUN npm install -g yarn --force

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build stage for production
FROM base AS build

# Build the application
RUN yarn build:all

# Test stage
FROM base AS test

# Copy test configuration
COPY vitest.config.ts vitest.setup.ts ./

# Run tests
CMD ["yarn", "test"] 