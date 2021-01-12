# Node MP3-Stream

A simple mp3 streamer / webserver written in JavaScript. All you need to run is [Node.js](https://nodejs.org/en/).
To actually play music please browse to [jsmusicdb](https://www.jsmusicdb.com) and provide credentials as you setup using the instructions below.

## Install

`git clone https://github.com/lucienimmink/node-mp3stream.git` or download [this file](https://github.com/lucienimmink/node-mp3stream/archive/master.zip)

then

`npm install`

## Run

`node app`

1st run will ask for the following settings

- port : external http port on which the webserver will listen.
- ssl : Do you want to use SSL; if so please answer Yes. (see notes about SSL)
- path : path where the music is stored; you can build the music database by navigating to <mp3streamurl:port>/rescan after you have logged in.
- username : specify a username that is able to use the program
- password : specify the password for the username

## About SSL

In `config.json` you can point to the certificate and the key used for SSL. Please update the paths manually. Most likely these files can only be read by the root user, if so restart the app as root.
You have to make sure that the the cert and key are up to date and valid.

## Docker

Included is a dockerfile to create and run a containerized version of node-mp3stream.

Build the container by issuing the command
`npm run docker:build`

And setup your first user
`npm run docker:setup`
Note that the server is now available.

To run it deamonized
`npm run docker: run`
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

where `<volume-name>` should be `music-share`, if you mount a local folder it's looks like this:

```yaml
docker volume create \
--driver local \ 
--opt type=none \
--opt device=//c/Users/<user name>/... \
--opt o=bind \
<volume-name>
```

Do this for both `music-share` and `data` and afterwards just run `npm run docker:run`, happy streaming!
