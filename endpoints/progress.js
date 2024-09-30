import fs from "node:fs";
import validateJwt from "./../modules/validateJwt.js";
import createLogger from "./../modules/logger.js";

const logger = createLogger("progress");
const progressFile = "./public/data/progress.txt";

export default function (req, res) {
  const jwt = req.query.jwt;
  validateJwt(jwt, function (val) {
    if (val) {
      // progress should be written to the output folder as a file progress.txt containing the actual percentage
      const hasProgressFile = fs.existsSync(progressFile);
      res.setHeader("Content-Type", "application/json");
      if (hasProgressFile) {
        const progress = fs.readFileSync(progressFile, "utf8");
        res.statusCode = 200;
        res.write(
          JSON.stringify({
            progress: progress,
            status: progress == "100" ? "ready" : "scanning",
          })
        );
      } else {
        res.statusCode = 200;
        res.write(
          JSON.stringify({
            status: "ready",
          })
        );
      }
      res.end();
    } else {
      logger.warn("User not authorized");
      res.statusCode = 401;
      res.end();
    }
  });
}
