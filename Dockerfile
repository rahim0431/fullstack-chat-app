FROM node:20-alpine

WORKDIR /app

# Copy only the backend's package.json
COPY backend/package*.json ./

# Install backend dependencies
RUN npm install

# Copy all the backend code
COPY backend/ ./

# Expose the API port
EXPOSE 5001

# Start the Node.js server
CMD ["npm", "start"]
