// simple middleware that sets cache headers for the various resourcetypes
module.exports = function(req, res, next) {
  if (
    req.url.indexOf("node-music.json") !== -1 ||
    req.url.indexOf("index.html") !== -1 ||
    req.url === "/"
  ) {
    res.setHeader("Cache-Control", "public, max-age=0"); // no cache
    res.setHeader("Expires", new Date(Date.now()).toUTCString());
  } else {
    var expires = new Date(Date.now());
    expires.setDate(expires.getDate() + 1);
    expires.setFullYear(expires.getFullYear() + 1);
    res.setHeader(
      "Cache-Control",
      `public, max-age=${expires.getTime()},immutable`
    ); // A year and a day
    res.setHeader("Expires", new Date(expires.getTime()).toUTCString());
  }
  next();
};
