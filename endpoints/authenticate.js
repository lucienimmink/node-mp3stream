import fs from "node:fs";
import { Crypto } from "@peculiar/webcrypto";
import db from "./../modules/db.js";
import generateJWT from "./../modules/generateJWT.js";
import { cryptoAlgorithm } from "./../modules/crypto.js";
import createLogger from "./../modules/logger.js";

const crypto = new Crypto();
const logger = createLogger("authenticate");

const encryptPassword = async (password) => {
  const publicKeyJSON = JSON.parse(
    fs.readFileSync("./.public-key.json", "utf8")
  );
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    publicKeyJSON,
    {
      name: cryptoAlgorithm.name,
      hash: cryptoAlgorithm.hash,
    },
    false,
    ["encrypt"]
  );
  const data = await crypto.subtle.encrypt(
    {
      name: cryptoAlgorithm.name,
    },
    publicKey,
    new TextEncoder().encode(password)
  );
  return Buffer.from(data).toString("base64");
};

export default async function authenticate(c) {
  let body;
  try {
    body = c.req.header("content-type")?.includes(
      "application/x-www-form-urlencoded"
    )
      ? await c.req.parseBody()
      : await c.req.json();
  } catch {
    return c.body(null, 400);
  }

  const { encryptedPayload } = body || {};
  if (typeof encryptedPayload !== "string" || encryptedPayload.length === 0) {
    return c.body(null, 401);
  }

  let payloadJSON;
  try {
    const payloadBuffer = Buffer.from(encryptedPayload, "base64");
    const privateKeyJSON = JSON.parse(
      fs.readFileSync("./.private-key.json", "utf8")
    );
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      privateKeyJSON,
      {
        name: cryptoAlgorithm.name,
        hash: cryptoAlgorithm.hash,
      },
      false,
      ["decrypt"]
    );
    const data = await crypto.subtle.decrypt(
      {
        name: cryptoAlgorithm.name,
      },
      privateKey,
      payloadBuffer
    );
    payloadJSON = JSON.parse(new TextDecoder().decode(data));
  } catch (error) {
    logger.warn(`Authentication payload could not be decrypted: ${error.message}`);
    return c.body(null, 401);
  }

  if (
    typeof payloadJSON?.name !== "string" ||
    typeof payloadJSON?.password !== "string"
  ) {
    return c.body(null, 401);
  }

  const encryptedPassword = await encryptPassword(payloadJSON.password);
  const authenticated = await new Promise((resolve, reject) => {
    db(payloadJSON.name, payloadJSON.password, resolve).catch(reject);
  });
  if (!authenticated) {
    return c.body(null, 401);
  }

  return c.json({
    jwt: await generateJWT({
      name: payloadJSON.name,
      encryptedPassword,
    }),
  });
}
