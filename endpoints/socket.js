var log4js = require("log4js"),
    chokidar = require('chokidar');
    fs = require('fs');

log4js.configure({
    appenders: { listen: { type: "file", filename: "logs/mp3stream.log" } },
    categories: { default: { appenders: ["listen"], level: "info" } }
});
const logger = log4js.getLogger("socket");
var progressFile = "./public/data/progress.txt";

var watcher = chokidar.watch(progressFile, {
    ignored: /[\/\\]\./, persistent: true
});

var sendMessage = function (socket, message, private)  {
    socket.emit(message.key, message.value);
    if (!private) {
        socket.broadcast.emit(message.key, message.value);
    }
}

module.exports = function (io) {
    io.on('connection', (socket) => {
        // what can we do with the socket?
        // we push the status of the rescan process
        // we can push certain notifications
        // we listen to ... 
        watcher
            .on('add', function() {
                sendMessage(socket, {
                    key: 'progress',
                    value: {
                        progress: 0,
                        status: 'ready'
                    }
                })
            })
            .on('change', function() { 
                var progress = fs.readFileSync(progressFile, "utf8");
                sendMessage(socket, {
                    key: 'progress',
                    value: {
                        progress: progress,
                        status: (progress === '100') ? 'ready' : 'scanning'
                    }
                })
            })
            .on('unlink', function() { 
                sendMessage(socket, {
                    key: 'progress',
                    value: {
                        progress: 0,
                        status: 'ready'
                    }
                })
            })
    });
}