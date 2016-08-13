# Node MP3-Stream
A simple mp3 streamer / webserver written in JavaScript.
## Install
`npm install`

## Run
`node app`

1st run will ask for the following settings
- port : external http port on which the webserver will listen.
- path : path where the music is stored; you can build the music database by navigating to <mp3streamurl:port>/rescan after you have logged in.
- username : specify a username that is able to use the program
- password : specify the password for the username

if <mp3streamurl:port>/data/node-music.json is not found or is empty a scan is triggered after running the app.
You can override the path to the musicdb file by setting the relative path in config.json

## Add an extra user
`node app adduser`

## Add a website
By default a prebuilt version of [JSMusicDB Next](https://github.com/lucienimmink/JSMusicDBNext) is installed and copied into the `/public` folder. If you do not wish to use JSMusicDBNext as the player set the config var `useJSMusicDB` to `false` in `config.json` and deploy your own website in `/public`