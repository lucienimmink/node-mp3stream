FROM node:15.5.0-alpine3.10

RUN apk update \
    && apk add sqlite \
    && apk add python2 \
    && apk add socat

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . ./
COPY .env.docker ./.env

COPY .node-music.json ./public/data/node-music.json

EXPOSE 16882

CMD ["node", "app.js"]
