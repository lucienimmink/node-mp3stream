import fs from "node:fs";
import createLogger from "../modules/logger.js";

const logger = createLogger("getImage");
const cacheDirectory = "public/data/cache";

const returnPath = (filePath, c) =>
  c.json({
    url: `//${c.req.header("host")}/data/cache/${filePath}`,
  });

const notFound = (c) =>
  c.body(null, 404, {
    "Cache-Control": "no-store",
    Expires: new Date(Date.now() - 1000).toUTCString(),
  });

export default function getImage(c) {
  const mbid = c.req.query("mbid");
  if (mbid) {
    if (!fs.existsSync(cacheDirectory)) {
      return notFound(c);
    }
    const matchedFile = fs.readdirSync(cacheDirectory).find((file) => file.includes(mbid));
    return matchedFile ? returnPath(matchedFile, c) : notFound(c);
  }

  const imageUrl = c.req.query("url");
  if (!imageUrl) {
    return c.body(null, 400);
  }
  logger.debug("looking up cached image");
  const cacheName = imageUrl
    .replace(/^https?:\/\//, "")
    .replace(/\//g, "_");
  return fs.existsSync(`${cacheDirectory}/${cacheName}`)
    ? returnPath(cacheName, c)
    : notFound(c);
}
