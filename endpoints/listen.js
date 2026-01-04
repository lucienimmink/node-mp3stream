import fs from "node:fs";
import validateJwt from "./../modules/validateJwt.js";
import createLogger from "./../modules/logger.js";

const logger = createLogger("listen");

const mimeTypes = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4a-latm',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/opus'
};

export default function (req, res) {
  if (!process.env.MUSICPATH || process.env.MUSICPATH === "") {
    logger.fatal("Configuration is not complete");
    res.statusCode = 500;
    res.end();
    return false;
  }
  const path = process.env.MUSICPATH + req.query.path;
  const full = req.query.full;
  const jwt = req.query.jwt;

  validateJwt(jwt, function (val) {
    if (val) {
      fs.exists(path, function (exists) {
        if (exists) {
          const ext = path.extname(req.query.path).toLowerCase();
          let mime = mimeTypes[ext];
          if (!mime) {
            mime = 'audio/mpeg';
            logger.warn("unknown mime for " + path);
          }
          if (req.headers.range) {
            logger.debug("partial streaming " + path);

            const stat = fs.statSync(path);
            const total = stat.size;

            const range = req.headers.range;
            const parts = range.replace(/bytes=/, "").split("-");
            const partialstart = parts[0];
            const partialend = parts[1];

            const start = parseInt(partialstart, 10);
            const end = partialend ? parseInt(partialend, 10) : total - 1;
            const chunksize = end - start + 1;

            const file = fs.createReadStream(path, { start: start, end: end });
            res.writeHead(206, {
              "Content-Range": "bytes " + start + "-" + end + "/" + total,
              "Accept-Ranges": "bytes",
              "Content-Length": chunksize,
              "Content-Type": mime,
            });
            file.pipe(res);
          } else {
            logger.debug("full stream " + path);
            const stat = fs.statSync(path);

            res.writeHead(200, {
              "Content-Type": mime,
              "Content-Length": stat.size,
            });

            const readStream = fs.createReadStream(path);
            readStream.pipe(res);
          }
        } else {
          logger.warn("no file with name " + path + " found");
          res.writeHead(404);
          res.end();
        }
      });
    } else {
      logger.warn("User not authorized");
      res.writeHead(401);
      res.end();
    }
  });
}
