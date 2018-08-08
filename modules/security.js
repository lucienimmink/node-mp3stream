var config = require("./../config.json");
var extensions = [".css", ".png", ".gif", ".jpg", ".ico", ".js"];
// some extra headers to improve security
module.exports = function(req, res, next) {
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security
  if (config.useSSL) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options
  extensions.forEach(function(extension) {
    if (req.url.indexOf(extension) !== -1) {
      res.setHeader("X-Content-Type-Options", "nosniff");
    }
  });
  if (req.url.indexOf('.js') !== -1) {
    res.setHeader("Content-Type", "text/javascript");
  }
  // always return
  next();
};
