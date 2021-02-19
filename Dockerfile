FROM node:15.9-alpine3.13

RUN apk update \
    && apk add sqlite \
    && apk add python2 \
    && apk add socat

WORKDIR /app

COPY . ./

RUN npm ci

COPY .env.docker ./.env

EXPOSE 16882

CMD ["node", "app.js"]
