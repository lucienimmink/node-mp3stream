const https = require("https");
const http = require("https");
const logger = require("../modules/logger")("proxy");
const validateJwt = require("./../modules/validateJwt");
const url = require("url");

module.exports = (req, res) => {
  const queryData = url.parse(req.url, true).query;
  const { remote, jwt } = queryData;
  validateJwt(jwt, function (val) {
    if (val) {
      if (remote) {
        const type = remote.startsWith("https") ? https : http;
        logger.debug(`fetching ${remote}`);
        const re = type.get(remote, (resp) => {
          let data = "";
          resp.on("data", (chunk) => {
            data += chunk;
          });
          resp.on("end", () => {
            res.writeHead(200, { 'content-type': resp.headers["content-type"] })
            res.write(data);
            res.end();
          });
        });
        re.on("error", (err) => {
          logger.error(`Remote (${remote}) returned an error: ${err}`);
          res.statusCode = 400;
          res.end();
        });
      } else {
        logger.warn("No remote given");
        res.statusCode = 400;
        res.end();
      }
    } else {
      res.statusCode = 401;
      res.end();
    }
  });
};
