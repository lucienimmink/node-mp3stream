FROM node:26.13.1-alpine

RUN npm install --global pnpm@12.16.1

RUN apk update \
    && apk add sqlite \
    && apk add python3 \
    && apk add socat \
    && ln -sf python3 /usr/bin/python

WORKDIR /app

COPY . ./

RUN pnpm install --frozen-lockfile

COPY .env.docker ./.env

EXPOSE 16882

CMD ["node", "app.js"]
