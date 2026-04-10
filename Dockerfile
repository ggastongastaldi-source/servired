FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG CACHE_BUST=1
RUN echo "Cache bust: 2$CACHE_BUST"
CMD ["node", "server.js"]
