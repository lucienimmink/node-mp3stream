import fs from "node:fs";
import validateJwt from "./../modules/validateJwt.js";

const progressFile = "./public/data/progress.txt";

export default async function progress(c) {
  if (!(await validateJwt(c.req.query("jwt")))) {
    return c.body(null, 401);
  }

  if (!fs.existsSync(progressFile)) {
    return c.json({ status: "ready" });
  }

  const value = fs.readFileSync(progressFile, "utf8");
  return c.json({
    progress: value,
    status: value === "100" ? "ready" : "scanning",
  });
}
