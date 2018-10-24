var CommandAsker = require("command-asker"),
  fs = require("fs"),
  dblite = require("dblite");

module.exports = function() {
  var a = new CommandAsker([
    {
      key: "username",
      ask: "What username do you want to use to authenticate? ",
      required: true
    },
    {
      key: "password",
      ask: "What password do you want to use ? ",
      required: true
    }
  ]);
  a.ask(function(response) {
    // setup the Database
    var db = dblite("./users.db");
    db.query(
      "INSERT OR REPLACE INTO users VALUES(?, ?)",
      [response.username, response.password],
      function(err, res) {
        console.log(
          "Config and user database has been set-up. Restart the app to start streaming."
        );
        db.close();
        a.close();
      }
    );
  });
};
