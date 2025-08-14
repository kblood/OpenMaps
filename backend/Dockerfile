FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S openmaps -u 1001

# Change ownership of the app directory
RUN chown -R openmaps:nodejs /app
USER openmaps

EXPOSE 3001

CMD ["npm", "start"]