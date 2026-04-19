FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG CACHE_BUST=1776596295364
RUN echo "Cache bust: 1776596295364"
CMD ["node", "server.js"]
