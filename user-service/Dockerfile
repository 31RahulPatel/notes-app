FROM node:lts-alpine
RUN apk update && apk upgrade --no-cache
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "app.js"]
