var jwt = require("jwt-simple");

module.exports = function(payload) {
  return jwt.encode(payload, "jsmusicdbnext");
};
