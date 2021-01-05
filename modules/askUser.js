var 
  prompts = require('prompts'),
  bcrypt = require('bcryptjs'),
  dblite = require("dblite");

module.exports = async function() {
  const { username } = await prompts({
    type: 'text',
    name: 'username',
    message: 'What username do you want to use to authenticate?',
  });
  const { password } = await prompts({
    type: 'password',
    name: 'password',
    message: 'What password do you want to use?',
  });
  hash(password, (hash) => {
    const db = dblite('./users.db');
    db.query(
      "INSERT OR REPLACE INTO users VALUES(?, ?)",
      [username, hash],
      function(err, res) {
        console.log(
          "Config and user database has been set-up. Restart the app to start streaming."
        );
        db.close();
        process.exit(0);
      }
    );
  })
};

const hash = (password, cb) => {
  const saltRounds = 10
  bcrypt.genSalt(saltRounds, function (err, salt) {
    if (err) {
      throw err
    } else {
      bcrypt.hash(password, salt, function(err, hash) {
        if (err) {
          throw err
        } else {
          cb(hash);
        }
      })
    }
  });
}