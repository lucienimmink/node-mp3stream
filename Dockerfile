FROM node:16.6-alpine3.13

RUN apk update \
    && apk add sqlite \
    && apk add python3 \
    && apk add socat \
    && ln -sf python3 /usr/bin/python

WORKDIR /app

COPY . ./

RUN npm ci

COPY .env.docker ./.env

EXPOSE 16882

CMD ["node", "app.js"]
