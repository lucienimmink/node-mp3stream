const dblite = require("dblite");
const log4js = require("log4js");

log4js.configure({
  appenders: { db: { type: "file", filename: "logs/mp3stream.log" } },
  categories: { default: { appenders: ["db"], level: "info" } }
});
const logger = log4js.getLogger("db");

var checkUser = function(account, passwd, cb, jwt, knownJWTTokens) {
  if (account && passwd) {
    var db = dblite("users.db");
    db.query(
      "SELECT * FROM users WHERE username = :account AND password = :passwd",
      {
        account: account,
        passwd: passwd
      },
      {
        username: String,
        passwd: String
      },
      function(rows) {
        var user = rows.length && rows[0];
        if (user.passwd === passwd) {
          logger.info("User " + account + " authenticated");
          if (jwt) knownJWTTokens[jwt] = true;
          if (cb) cb(true);
        } else {
          logger.error("User " + account + " NOT authenticated");
          if (jwt) knownJWTTokens[jwt] = false;
          if (cb) cb(false);
        }
      }
    );
  } else {
    logger.warn("No user specified, NOT authenticated");
    if (jwt) knownJWTTokens[jwt] = false;
    if (cb) cb(false);
  }
};

module.exports = checkUser;
