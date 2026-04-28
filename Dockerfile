FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
ARG CACHE_BUST
RUN echo "Cache bust: ${CACHE_BUST}"
COPY . .
CMD ["node", "server.js"]
