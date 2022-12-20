var validateJwt = require("./../modules/validateJwt"),
  fs = require("fs"),
  logger = require("./../modules/logger")("rescan");

var progressFile = "./public/data/progress.txt";

var parseProgress = (progress) => {
  return JSON.stringify({
    progress,
    status: progress == "100" ? "ready" : "scanning",
  })
};

var poll = (req, force) => {
  var clients = req.app.locals.clients;
  if (force) {
    clients.forEach(client => {
      client.res.write(`data: ${parseProgress()}\n\n`)
    });
    setTimeout(() => {
      poll(req, false);
    }, 1000);
  } else {
    // read progress file
    var hasProgressFile = fs.existsSync(progressFile);
    if (hasProgressFile) {
      var progress = fs.readFileSync(progressFile, "utf8");
    }
    // tell clients the progress is updated
    clients.forEach(client => client.res.write(`data: ${parseProgress(progress)}\n\n`));
    // if progress is not 100, poll again
    if (progress != "100") {
      setTimeout(() => {
        poll(req, false);
      }, 1000);
    }
  }
}

function initiateScan(req) {
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
      poll(req, true);
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
      initiateScan(req);
      res.statusCode = 204;
      res.end();
    } else {
      logger.warn("User not authorized");
      res.statusCode = 401;
      res.end();
    }
  });
};
