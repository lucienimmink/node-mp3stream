var validateJwt = require("./../modules/validateJwt"),
  log4js = require("log4js");

log4js.configure({
  appenders: { login: { type: "file", filename: "logs/mp3stream.log" } },
  categories: { default: { appenders: ["login"], level: "info" } }
});
const logger = log4js.getLogger("login");

module.exports = function(req, res) {
  logger.info("Starting authentication");
  // decode the JWT token
  if (req.headers["x-cred"]) {
    validateJwt(req.headers["x-cred"], function(valid) {
      res.jsonp({
        success: valid
      });
    });
  } else {
    res.statusCode = 401;
    res.end();
  }
};
