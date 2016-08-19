# Node MP3-Stream
A simple mp3 streamer / webserver written in JavaScript. All you need to run is [Node.js](https://nodejs.org/en/). 
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

if <mp3streamurl:port>/data/node-music.json is not found or is empty a scan is triggered after running the app.
You can override the path to the musicdb file by setting the relative path in config.json

## Add an extra user
`node app adduser`

## Add a website
By default a prebuilt version of [JSMusicDB Next](https://github.com/lucienimmink/JSMusicDBNext) is installed and copied into the `/public` folder. If you do not wish to use JSMusicDBNext as the player set the config var `useJSMusicDB` to `false` in `config.json` and deploy your own website in `/public`

## About SSL
In `config.json` you can point to the certificate and the key used for SSL. Please update the paths manually. Most likely these files can only be read by the root user, if so restart the app as root.
You have to make sure that the the cert and key are up to date and valid.