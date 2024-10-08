import createLogger from "../modules/logger.js";
import fs from "fs";
import Busboy from "busboy";

const logger = createLogger("postImage");

export default (req, res) => {
  const busboy = new Busboy({ headers: req.headers });
  let cachename;
  busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
    file.pipe(fs.createWriteStream(`public/data/cache/${filename}`));
    cachename = filename;
  });
  busboy.on("finish", () => {
    logger.info(`cache file written for ${cachename}`);
    res.writeHead(201, { 'Connection': 'Close', 'Content-Type': 'application/json'});
    res.end(JSON.stringify({ cachename }));
  });
  req.pipe(busboy);
};
