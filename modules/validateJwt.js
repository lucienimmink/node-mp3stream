var jwt = require("jwt-simple"),
  db = require("./db");

var knownJWTTokens = {};

var parseToken = function(token) {
  if (!token) {
    return false;
  }
  var decoded = jwt.decode(token, "jsmusicdbnext");
  if (typeof decoded === "string") {
    decoded = JSON.parse(decoded);
  }
  return decoded;
};

module.exports = function(jwt, cb) {
  if (!knownJWTTokens[jwt]) {
    var decoded = parseToken(jwt);
    if (!decoded) {
      cb(false);
    }
    db(decoded.name, decoded.password, cb, jwt, knownJWTTokens);
  } else {
    cb(true);
  }
};
