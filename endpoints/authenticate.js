const fs = require("fs");
const db = require("./../modules/db");
const generateJWT = require("./../modules/generateJWT");
const { Crypto } = require("@peculiar/webcrypto");
const log4js = require("log4js");

const crypto = new Crypto();

log4js.configure({
  appenders: { authenticate: { type: "file", filename: "logs/mp3stream.log" } },
  categories: { default: { appenders: ["authenticate"], level: "info" } }
});
const logger = log4js.getLogger("authenticate");

module.exports = async function(req, res) {
  const { encryptedPayload } = req.body;
  if (!encryptedPayload) {
    req.statusCode = 401;
    res.end();
    return;
  }
  const ab2str = function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  };
  const payloadBuffer = Buffer.from(encryptedPayload, "base64");
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
  const payloadJSON = JSON.parse(ab2str(data));
  // this should contain name and password; use that to verify the account
  db(payloadJSON.name, payloadJSON.password, result => {
    if (!result) {
      res.statusCode = 401;
      res.end();
      return;
    }
    const jwt = generateJWT(payloadJSON);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.write(
      JSON.stringify({
        jwt
      })
    );
    res.end();
  });
};
