import { readFileSync } from "node:fs";

export default function publicKey(c) {
  const key = readFileSync("./.public-key.json", "utf-8");
  return c.json(JSON.parse(key));
}
