import { sign } from "hono/jwt";
import getJwtSecret from "./jwtSecret.js";

export default async function generateJWT(payload) {
  const issuedAt = Math.floor(Date.now() / 1000);
  return sign(
    {
      ...payload,
      iat: issuedAt,
      exp: issuedAt + 24 * 60 * 60,
    },
    getJwtSecret(),
    "HS256"
  );
}
