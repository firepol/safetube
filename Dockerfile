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

# Install yt-dlp
RUN pip3 install --no-cache-dir yt-dlp

# Install Yarn
RUN npm install -g yarn

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