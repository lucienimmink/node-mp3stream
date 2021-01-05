FROM node:15.5.0-alpine3.10

RUN apk update \
    && apk add sqlite \
    && apk add socat

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . ./
COPY .env.docker ./.env

EXPOSE 16882

CMD ["node", "app.js"]
