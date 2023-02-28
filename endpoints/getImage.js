const logger = require("../modules/logger")("getImage");
const fs = require("fs");
const url = require("url");

const returnPath = (path, req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      url: `//${req.headers.host}/data/cache/${path}`,
    })
  );
};

module.exports = (req, res) => {
  const queryData = url.parse(req.url, true).query;
  const mbid = queryData.mbid;
  if (mbid) {
    const files = fs.readdirSync(`public/data/cache`);
    const matchedFiles = files.filter((file) => file.includes(mbid));
    if (matchedFiles.length > 0) {
      returnPath(matchedFiles[0], req, res);
    } else {
      // don't cache 404 results please
      res.removeHeader("Cache-Control");
      res.setHeader(
        "Expires",
        new Date(new Date().getTime() - 1).toUTCString()
      );
      res.writeHead(404, "Not found");
      res.end();
    }
    return;
  }
  let cacheName = queryData.url;
  if (cacheName.includes("https://")) {
    cacheName = cacheName.substring(8);
  }
  if (cacheName.includes("http://")) {
    cacheName = cacheName.substring(7);
  }
  cacheName = cacheName.replace(/\//g, `_`);
  if (fs.existsSync(`public/data/cache/${cacheName}`)) {
    logger.debug('returning cached image')
    returnPath(cacheName, req, res);
  } else {
    logger.debug('no cached image found')
    res.removeHeader("Cache-Control");
    res.setHeader(
      "Expires",
      new Date(new Date().getTime() - 1).toUTCString()
    );
    res.writeHead(404, "Not found");
    res.end();
  }
};
