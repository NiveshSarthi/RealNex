FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the backend port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]