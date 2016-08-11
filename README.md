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
You can add your website in the /public folder. One site that is already fully configured and functional is [JSMusicDB Next](https://github.com/lucienimmink/JSMusicDBNext); place the compiled output (see details in the readme of JSMusicDB Next) in the public folder and you are all set.