FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 PHOTO_BEO_DATA_DIR=/data
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3001
CMD ["npm", "start"]
