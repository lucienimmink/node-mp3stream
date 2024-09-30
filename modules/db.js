import SQLiteTagSpawned from "sqlite-tag-spawned";
import bcrypt from "bcryptjs";
import createLogger from "./logger.js";

const logger = createLogger("db");

export default async function checkUser(account, passwd, cb, jwt, knownJWTTokens) {
  if (account && passwd) {
    const { get, close } = SQLiteTagSpawned("./public/data/secure/users.db");
    const { password } =
      await get`SELECT * FROM users WHERE username = ${account}`;
    compare(passwd, password, (compares) => {
      if (compares) {
        logger.info("User " + account + " authenticated");
        if (jwt) knownJWTTokens[jwt] = true;
        close();
        if (cb) cb(true);
      } else {
        logger.error("User " + account + " NOT authenticated");
        if (jwt) knownJWTTokens[jwt] = false;
        close();
        if (cb) cb(false);
      }
    });
  } else {
    logger.warn("No user specified, NOT authenticated");
    if (jwt) knownJWTTokens[jwt] = false;
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
