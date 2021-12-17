const request = require("request");
const logger = require("../modules/logger")("getImage");
const fs = require("fs");
const url = require("url");

const serveFile = (path, res) => {
  logger.info(`Serving cached image for ${path}`);
  fs.readFile(path, (err, buffer) => {
    res.writeHead(200, {
      "Content-Length": Buffer.byteLength(buffer),
      "Content-Type": "image/png",
    });
    res.write(buffer, () => {
      res.end();
    });
  });
};

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

module.exports = (req, res) => {
  const queryData = url.parse(req.url, true).query;
  let cacheName = queryData.url;
  if (cacheName.includes("https://")) {
    cacheName = cacheName.substring(8)
  }
  if (cacheName.includes("http://")) {
    cacheName = cacheName.substring(7)
  }
  cacheName = cacheName.replace(/\//g,`_`);
  if (fs.existsSync(`public/data/cache/${cacheName}`)) {
    serveFile(`public/data/cache/${cacheName}`, res);
  } else {
    cacheFile(queryData, res, cacheName, () => {
      serveFile(`public/data/cache/${cacheName}`, res);
    });
  }
};
