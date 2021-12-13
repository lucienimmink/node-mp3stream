const fs = require("fs");
const { Crypto } = require("@peculiar/webcrypto");
const db = require("./../modules/db");
const generateJWT = require("./../modules/generateJWT");

const crypto = new Crypto();

const ab2str = function ab2str(buf) {
  return new TextDecoder().decode(buf);
};

const encryptPassword = async (password) => {
  const publicKeyJSON = JSON.parse(
    fs.readFileSync("./.public-key.json", "utf8")
  );
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    publicKeyJSON,
    {
      name: "RSA-OAEP",
      hash: "SHA-256"
    },
    false,
    ["encrypt"]
  );
  const data = await crypto.subtle.encrypt(
    {
      name: "RSA-OAEP"
    },
    publicKey,
    new TextEncoder().encode(password)
  );
  const buffer = Buffer.from(data);
  return buffer.toString("base64");
};

module.exports = async function(req, res) {
  const { encryptedPayload } = req.body;
  if (!encryptedPayload) {
    req.statusCode = 401;
    res.end();
    return;
  }
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
  try {
    const data = await crypto.subtle.decrypt(
      {
        name: "RSA-OAEP"
      },
      privateKey,
      payloadBuffer
    );
    const payloadJSON = JSON.parse(ab2str(data));
    const encryptedPassword = await encryptPassword(payloadJSON.password);
    // this should contain name and password; use that to verify the account
    db(payloadJSON.name, payloadJSON.password, result => {
      if (!result) {
        res.statusCode = 401;
        res.end();
        return;
      }
      const jwt = generateJWT({
        name: payloadJSON.name,
        encryptedPassword
      });
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.write(
        JSON.stringify({
          jwt
        })
      );
      res.end();
    });
  } catch (e) {
    res.statusCode = 401;
    res.end();
    return;
  }
};
