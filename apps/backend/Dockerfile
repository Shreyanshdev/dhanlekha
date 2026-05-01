FROM node:18-alpine

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy root package files
COPY package.json ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm install --workspace=apps/backend --workspace=packages/shared

# Copy source code
COPY apps/backend ./apps/backend
COPY packages/shared ./packages/shared

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3001

CMD ["npm", "run", "dev", "--workspace=apps/backend"]
