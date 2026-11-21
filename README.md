# Node MP3-Stream

A simple mp3 streamer/webserver written in JavaScript with Hono. All you need to run is [Node.js](https://nodejs.org/en/).
To play music please browse to [JSMusicDB](https://www.jsmusicdb.com) and provide credentials as you setup using the instructions below.

## Install

`git clone https://github.com/lucienimmink/node-mp3stream.git` or download [this file](https://github.com/lucienimmink/node-mp3stream/archive/master.zip)

then

`pnpm install --frozen-lockfile`

## Run

`pnpm start`

The JWT signing key is generated and persisted in `public/data/secure/jwt-secret`.
Set `JWT_SECRET` (at least 32 characters) when multiple instances need to share tokens.
Tokens expire after 24 hours; tokens issued before this upgrade require users to sign in again.
Cross-origin access is limited to JSMusicDB by default; set `CORS_ORIGINS` to a
comma-separated list of trusted origins to allow other web clients.

1st run will ask for the following settings

- port: external HTTP port on which the webserver will listen.
- ssl: Do you want to use SSL; if so please answer Yes. (see notes about SSL)
- path: path where the music is stored; you can build the music database by navigating to <mp3streamurl:port>/rescan after you have logged in.
- username: specify a username that can use the program
- password: specify the password for the username

## About SSL

In `config.json` you can point to the certificate and the key used for SSL. Please update the paths manually. Most likely these files can only be read by the root user, if so restart the app as root.
You have to make sure that the cert and key are up-to-date and valid.

## Docker

Included is a dockerfile to create and run a containerized version of node-mp3stream.

Build the container by issuing the command
`pnpm run docker:build`

And setup your first user
`pnpm run docker:setup`
Note that the server is now available.

To run it deamonized
`pnpm run docker:run`
Please refer to the `package.json` to alter settings like the port and music volume.

### volumes

Create named volume that you mount, for example:

```yaml
docker volume create \
--driver local \
--opt type=cifs \
--opt device=//<network-device-ip-folder> \
--opt o=user=<your-user>,password=<your-pw> \
<volume-name>
```

where `<volume-name>` should be `music-share`, if you mount a local folder it looks like this:

```yaml
docker volume create \
--driver local \ 
--opt type=none \
--opt device=//c/Users/<user name>/... \
--opt o=bind \
<volume-name>
```

Do this for both `music-share` and `data` and afterward just run `pnpm run docker:run`; happy streaming!
