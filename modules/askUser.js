var prompts = require("prompts"),
  bcrypt = require("bcryptjs"),
  dblite = require("dblite"),
  logger = require('./logger')('ask-user');

module.exports = async function (exit = false, cb) {
  const { proceed } = await prompts({
    type: "confirm",
    name: "proceed",
    message: "Do you want to add a new user?",
    initial: true,
  });
  if (!proceed) {
    if (exit) process.exit(0);
    cb();
  }
  const { username } = await prompts({
    type: "text",
    name: "username",
    message: "What username do you want to use to authenticate?",
  });
  const { password } = await prompts({
    type: "password",
    name: "password",
    message: "What password do you want to use?",
  });
  hash(password, (hash) => {
    const db = dblite(`./public/data/secure/users.db`);
    db.query(
      "CREATE TABLE IF NOT EXISTS users (username TEXT, password TEXT)",
      function (err, res) {
        db.query(
          "INSERT OR REPLACE INTO users VALUES(?, ?)",
          [username, hash],
          function (err, res) {
            if (err) throw err;
            logger.info(`User '${username}' added`);
            db.close();
            if (exit) process.exit(0);
            cb();
          }
        );
      }
    );
  });
};

const hash = (password, cb) => {
  const saltRounds = 10;
  bcrypt.genSalt(saltRounds, function (err, salt) {
    if (err) {
      throw err;
    } else {
      bcrypt.hash(password, salt, function (err, hash) {
        if (err) {
          throw err;
        } else {
          cb(hash);
        }
      });
    }
  });
};
