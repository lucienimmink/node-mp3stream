const request = require("request");
const logger = require("../modules/logger")("getImage");
const fs = require("fs");
const url = require("url");

const cacheFile = (queryData, res, cacheName, cb) => {
  logger.info(`Creating cached image for ${cacheName}`);
  let cacheData = "";
  if (queryData.url) {
    request({
      url: queryData.url,
    })
      .on("error", (e) => {
          logger.error(`Error creating cached image for ${cacheName}`, e);
        res.end(e);
      })
      .on("end", (e) => {
        if (cacheData) {
          fs.writeFile(
            `public/data/cache/${cacheName}`,
            cacheData,
            "binary",
            (err, data) => {
              if (err) {
                logger.error(`Error creating cached image for ${cacheName}`, err);
              } else {
                cb();
              }
            }
          );
        }
      })
      .on("response", (r) => {
        r.setEncoding("binary");
        r.on("data", (chunk) => {
          cacheData += chunk;
        });
      });
  }
};

const returnPath = (path, req, res) => {
  res.writeHead(200, {"Content-Type": "application/json"});
  res.end(JSON.stringify({
    url: `//${req.headers.host}/data/cache/${path}`
  }));
}

module.exports = (req, res) => {
  const queryData = url.parse(req.url, true).query;
  const mbid = queryData.mbid;
  if (mbid) {
    const files = fs.readdirSync(`public/data/cache`);
    const matchedFiles = files.filter(file => file.includes(mbid));
    if (matchedFiles.length > 0) {
      returnPath(matchedFiles[0], req, res);
    } else {
      res.writeHead(404, "Not found");
      res.end();
    }
    return;
  }
  let cacheName = queryData.url;
  if (cacheName.includes("https://")) {
    cacheName = cacheName.substring(8)
  }
  if (cacheName.includes("http://")) {
    cacheName = cacheName.substring(7)
  }
  cacheName = cacheName.replace(/\//g,`_`);
  if (fs.existsSync(`public/data/cache/${cacheName}`)) {
    returnPath(cacheName, req, res);
  } else {
    cacheFile(queryData, res, cacheName, () => {
      returnPath(cacheName, req, res);
    });
  }
};
