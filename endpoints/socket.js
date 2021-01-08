var chokidar = require("chokidar"),
  logger = require("./../modules/logger")("socket"),
  fs = require("fs");

var progressFile = "./public/data/progress.txt";

var watcher = chokidar.watch(progressFile, {
  ignored: /[\/\\]\./,
  persistent: true,
});

var sendMessage = function (socket, message, private) {
  socket.emit(message.key, message.value);
  if (!private) {
    socket.broadcast.emit(message.key, message.value);
  }
};

module.exports = function (io) {
  io.on("connection", (socket) => {
    // what can we do with the socket?
    // we push the status of the rescan process
    // we can push certain notifications
    // we listen to ...
    watcher
      .on("add", function () {
        sendMessage(socket, {
          key: "progress",
          value: {
            progress: 0,
            status: "ready",
          },
        });
        logger.info('client added');
      })
      .on("change", function () {
        var progress = fs.readFileSync(progressFile, "utf8");
        sendMessage(socket, {
          key: "progress",
          value: {
            progress: parseInt(progress),
            status: progress === "100" ? "ready" : "scanning",
          },
        });
      })
      .on("unlink", function () {
        sendMessage(socket, {
          key: "progress",
          value: {
            progress: 0,
            status: "ready",
          },
        });
        logger.info('client removed');
      });
  });
};
