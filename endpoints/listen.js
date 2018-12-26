var validateJwt = require("./../modules/validateJwt"),
  fs = require("fs"),
  log4js = require("log4js");

log4js.configure({
  appenders: { listen: { type: "file", filename: "logs/mp3stream.log" } },
  categories: { default: { appenders: ["listen"], level: "info" } }
});
const logger = log4js.getLogger("listen");

module.exports = function(req, res) {
  if (!process.env.MUSICPATH || process.env.MUSICPATH === "") {
    logger.fatal("Configuration is not complete");
    res.statusCode = 500;
    res.end();
    return false;
  }
  var path = process.env.MUSICPATH + req.query.path,
    full = req.query.full,
    jwt = req.query.jwt;
  validateJwt(jwt, function(val) {
    if (val) {
      fs.exists(path, function(exists) {
        if (exists) {
          var mime = "audio/mpeg";

          if (path.indexOf(".flac") !== -1) {
            mime = "audio/flac";
          } else if (path.indexOf(".m4a") !== -1) {
            mime = "audio/mp4a-latm";
          }
          if (req.headers.range) {
            logger.debug("partial streaming " + path);

            var stat = fs.statSync(path);
            var total = stat.size;

            var range = req.headers.range;
            var parts = range.replace(/bytes=/, "").split("-");
            var partialstart = parts[0];
            var partialend = parts[1];

            var start = parseInt(partialstart, 10);
            var end = partialend ? parseInt(partialend, 10) : total - 1;
            var chunksize = end - start + 1;

            var file = fs.createReadStream(path, { start: start, end: end });
            res.writeHead(206, {
              "Content-Range": "bytes " + start + "-" + end + "/" + total,
              "Accept-Ranges": "bytes",
              "Content-Length": chunksize,
              "Content-Type": mime
            });
            file.pipe(res);
          } else {
            logger.debug("full stream " + path);
            var stat = fs.statSync(path);

            res.writeHead(200, {
              "Content-Type": mime,
              "Content-Length": stat.size
            });

            var readStream = fs.createReadStream(path);
            readStream.pipe(res);
          }
        } else {
          logger.warn("no file with name " + path + " found");
          res.writeHead(404);
          res.end();
        }
      });
    } else {
      logger.warn("User not authorized");
      res.writeHead(401);
      res.end();
    }
  });
};
