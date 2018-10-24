var extensions = [".css", ".png", ".gif", ".jpg", ".ico", ".js"];
// some extra headers to improve security
module.exports = function(req, res, next) {
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security
  if (process.env.USESSL === "true") {
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

  // override mime-types
  if (req.url.indexOf(".js") !== -1) {
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
  }
  if (req.url.indexOf(".webmanifest") !== -1) {
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  }
  // always return
  next();
};
