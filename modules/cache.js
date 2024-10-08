// simple middleware that sets cache headers for the various resourcetypes
export default function(req, res, next) {
  if (
    req.url.indexOf("node-music.json") !== -1 ||
    req.url.indexOf("index.html") !== -1 ||
    req.url.indexOf("version") !== -1 ||
    req.url.indexOf("public-key") !== -1 ||
    req.url.indexOf("proxy") !== -1 ||
    req.url === "/"
  ) {
    res.setHeader("Cache-Control", "public, max-age=0"); // no cache
    res.setHeader("Expires", new Date(Date.now()).toUTCString());
  } else {
    const expires = new Date(Date.now());
    expires.setDate(expires.getDate() + 1);
    expires.setFullYear(expires.getFullYear() + 1);
    res.setHeader(
      "Cache-Control",
      `public, max-age=${expires.getTime()},immutable`
    ); // A year and a day
    res.setHeader("Expires", new Date(expires.getTime()).toUTCString());
  }
  next();
}
