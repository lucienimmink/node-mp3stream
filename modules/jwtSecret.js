import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const secretPath = path.resolve("./public/data/secure/jwt-secret");

const readSecret = () => {
  const secret = fs.readFileSync(secretPath, "utf8").trim();
  if (secret.length < 32) {
    throw new Error("Stored JWT secret is invalid");
  }
  return secret;
};

export default function getJwtSecret() {
  if (process.env.JWT_SECRET !== undefined) {
    if (process.env.JWT_SECRET.length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters long");
    }
    return process.env.JWT_SECRET;
  }

  fs.mkdirSync(path.dirname(secretPath), { recursive: true, mode: 0o700 });
  try {
    return readSecret();
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const secret = randomBytes(32).toString("base64url");
  try {
    fs.writeFileSync(secretPath, secret, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    return secret;
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
    return readSecret();
  }
}
