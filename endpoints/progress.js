var validateJwt = require("./../modules/validateJwt"),
  fs = require("fs"),
  log4js = require("log4js");

log4js.configure({
  appenders: { progress: { type: "file", filename: "logs/mp3stream.log" } },
  categories: { default: { appenders: ["progress"], level: "info" } }
});
const logger = log4js.getLogger("progress");

var progressFile = "./public/data/progress.txt";

module.exports = function(req, res) {
  var jwt = req.query.jwt;
  validateJwt(jwt, function(val) {
    if (val) {
      // progress should be written to the output folder as a file progress.txt containing the actual percentage
      var hasProgressFile = fs.existsSync(progressFile);
      if (hasProgressFile) {
        var progress = fs.readFileSync(progressFile, "utf8");
        res.statusCode = 200;
        res.write(
          JSON.stringify({
            progress: progress,
            status: progress == "100" ? "ready" : "scanning"
          })
        );
      } else {
        res.statusCode = 200;
        res.write(
          JSON.stringify({
            status: "ready"
          })
        );
      }
      res.end();
    } else {
      logger.warn("User not authorized");
      res.statusCode = 401;
      res.end();
    }
  });
};
