import jwt from "jwt-simple";

export default function generateJWT(payload) {
  return jwt.encode(payload, "jsmusicdbnext");
}
