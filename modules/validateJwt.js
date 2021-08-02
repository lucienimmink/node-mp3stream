const fs = require("fs");
const { Crypto } = require("@peculiar/webcrypto");
var jwt = require("jwt-simple"),
  db = require("./db");


var knownJWTTokens = {};

const crypto = new Crypto();

const decryptPassword = async (encrypted) => {
  const payloadBuffer = Buffer.from(encrypted, "base64");
  const privateKeyJSON = JSON.parse(
    fs.readFileSync("./.private-key.json", "utf8")
  );
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    privateKeyJSON,
    {
      name: "RSA-OAEP",
      hash: "SHA-256"
    },
    false,
    ["decrypt"]
  );
  const data = await crypto.subtle.decrypt(
    {
      name: "RSA-OAEP"
    },
    privateKey,
    payloadBuffer
  );
  return new TextDecoder().decode(data);
};

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

module.exports = async function(jwt, cb) {
  if (!knownJWTTokens[jwt]) {
    var decoded = parseToken(jwt);
    if (!decoded) {
      cb(false);
    }
    // for now we keep support for unencrypted passwords as well; for now :)
    let password = decoded.password;
    if (decoded.encryptedPassword) {
      password = await decryptPassword(decoded.encryptedPassword);
    }
    db(decoded.name, password, cb, jwt, knownJWTTokens);
  } else {
    cb(true);
  }
};
