import { readFileSync } from "node:fs";

export default function(req, res) {
  const key = readFileSync("./.public-key.json", "utf-8");
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.write(key);
  res.end();
}
