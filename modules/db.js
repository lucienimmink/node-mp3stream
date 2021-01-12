const bcrypt = require("bcryptjs");
const dblite = require("dblite");
const outdir = process.env.MUSICDB;
const logger = require('./logger')('db');

var checkUser = function (account, passwd, cb, jwt, knownJWTTokens) {
  if (account && passwd) {
    const db = dblite(`${outdir}users.db`);
    db.query(
      "SELECT * FROM users WHERE username = :account",
      {
        account: account,
      },
      {
        username: String,
        passwd: String,
      },
      function (rows) {
        var user = rows.length && rows[0];
        compare(passwd, user.passwd, (compares) => {
          if (compares) {
            logger.info("User " + account + " authenticated");
            if (jwt) knownJWTTokens[jwt] = true;
            db.close();
            if (cb) cb(true);
          } else {
            logger.error("User " + account + " NOT authenticated");
            if (jwt) knownJWTTokens[jwt] = false;
            db.close();
            if (cb) cb(false);
          }
        });
      }
    );
  } else {
    logger.warn("No user specified, NOT authenticated");
    if (jwt) knownJWTTokens[jwt] = false;
    db.close();
    if (cb) cb(false);
  }
};

const compare = (password, hash, cb) => {
  bcrypt.compare(password, hash, function (err, isMatch) {
    if (err) {
      throw err;
    } else if (!isMatch) {
      cb(false);
    } else {
      cb(true);
    }
  });
};

module.exports = checkUser;
