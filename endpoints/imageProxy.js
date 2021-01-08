var request = require("request"),
  logger = require("../modules/logger")("image-proxy"),
  fs = require("fs"),
  url = require("url");

var serveFile = function (path, res) {
  fs.readFile(path, function (err, buffer) {
    res.writeHead(200, {
      "Content-Length": Buffer.byteLength(buffer),
      "Content-Type": "image/png",
    });
    res.write(buffer, function () {
      res.end();
    });
  });
};

var cacheFile = function (queryData, res, cacheName, cb) {
  var cacheData = "";
  if (queryData.url) {
    request({
      url: queryData.url,
    })
      .on("error", function (e) {
        res.end(e);
      })
      .on("end", function (e) {
        if (cacheData) {
          logger.info("write cache as " + cacheName);
          fs.writeFile(
            "public/data/cache/" + cacheName,
            cacheData,
            "binary",
            function (err, data) {
              if (err) {
                logger.error(err);
              } else {
                cb();
              }
            }
          );
        }
      })
      .on("response", function (r) {
        r.setEncoding("binary");
        r.on("data", function (chunk) {
          cacheData += chunk;
        });
      });
  }
};

module.exports = function (req, res) {
  var queryData = url.parse(req.url, true).query;
  var cacheName = queryData.url;
  cacheName = cacheName.substr(cacheName.indexOf("300x300") + 7);
  if (fs.existsSync("public/data/cache/" + cacheName)) {
    // serve this file
    serveFile("public/data/cache/" + cacheName, res);
  } else {
    // get file from internet, store it and then serve it.
    cacheFile(queryData, res, cacheName, function () {
      serveFile("public/data/cache/" + cacheName, res);
    });
  }
};
