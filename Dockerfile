# Use a lightweight Node.js base image
FROM node:20-alpine

# Install OS-level dependencies required for canvas/tesseract/jimp if needed
# (Optional but usually prevents build errors for image processing libs)
RUN apk add --no-cache build-base g++ cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the TypeScript project into the /dist directory
RUN npx tsc

# Expose the API port (must match process.env.PORT or 8080)
EXPOSE 8080

# Start the compiled JavaScript API
CMD ["node", "dist/server.js"]
