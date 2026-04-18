FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG CACHE_BUST=1
RUN echo "Cache bust: 1776544129744"
CMD ["node", "server.js"]
