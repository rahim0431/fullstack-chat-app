FROM node:18-alpine

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy all the rest of the backend files
COPY . .

# Expose the port the app runs on
EXPOSE 5001

# Start the application
CMD ["npm", "start"]
