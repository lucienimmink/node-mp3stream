const { generateKeyPairSync } = require("crypto");
const pem2jwk = require("pem-jwk").pem2jwk;
const generatePassword = require("password-generator");
const fs = require("fs");
const log4js = require("log4js");

log4js.configure({
  appenders: { crypto: { type: "file", filename: "logs/mp3stream.log" } },
  categories: { default: { appenders: ["crypto"], level: "info" } }
});
const logger = log4js.getLogger("crypto");

const generateKeys = () => {
  // we generate a new keypair to be used for encryption
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: "spki",
      format: "pem"
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
      cipher: "aes-256-cbc",
      passphrase: generatePassword(24, false)
    }
  });
  const jwk = pem2jwk(publicKey);
  fs.writeFileSync("./.public-key.json", JSON.stringify(jwk));
  fs.writeFileSync("./.private-key.pem", privateKey);
  logger.info("Generated and stored a new keypair");
};

const doKeysExist = () => {
  return (
    fs.existsSync("./.public-key.json") && fs.existsSync("./.private-key.pem")
  );
};

module.exports = {
  doKeysExist,
  generateKeys
};
