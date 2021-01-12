var validateJwt = require("./../modules/validateJwt"),
  logger = require("./../modules/logger")("rescan");

function initiateScan() {
  var exec = require("child_process").exec;
  exec("python --version", function (error, stdout, stderr) {
    var out = (stdout = stderr);
    var hasPython = false;
    if (out.indexOf("2.") !== 0) {
      logger.info("python is installed");
      hasPython = true;
    }
    if (hasPython) {
      // spawn python process
      var outdir = process.env.MUSICDB;
      exec(
        "python ./node_modules/scanner.py/scanner.py " +
          process.env.MUSICPATH +
          " --destpath " +
          outdir,
        function (error, stdout, stderr) {
          logger.info(stdout);
        }
      );
    } else {
      logger.fatal(
        "Python is needed to scan all files on the system; cannot continue"
      );
    }
  });
}

module.exports = function (req, res) {
  var jwt = req.query.jwt;
  validateJwt(jwt, function (val) {
    if (val) {
      initiateScan();
      res.statusCode = 204;
      res.end();
    } else {
      logger.warn("User not authorized");
      res.statusCode = 401;
      res.end();
    }
  });
};
