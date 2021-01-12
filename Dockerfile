FROM node:15.5.1-alpine3.12

RUN apk update \
    && apk add sqlite \
    && apk add python2 \
    && apk add socat

WORKDIR /app

COPY . ./

RUN npm install

COPY .env.docker ./.env

COPY .node-music.json ./public/data/node-music.json

EXPOSE 16882

CMD ["node", "app.js"]
