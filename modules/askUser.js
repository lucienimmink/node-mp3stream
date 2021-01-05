var prompts = require("prompts"),
  bcrypt = require("bcryptjs"),
  dblite = require("dblite");

module.exports = async function (exit = false, cb) {
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
    const db = dblite("./users.db");
    db.query(
      "CREATE TABLE IF NOT EXISTS users (username TEXT, password TEXT)",
      function(err, res) {
        db.query(
          "INSERT OR REPLACE INTO users VALUES(?, ?)",
          [username, hash],
          function (err, res) {
            if (err)
              throw err;
            console.log("Config and user database has been set-up.");
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
