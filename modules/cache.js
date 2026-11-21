// simple middleware that sets cache headers for the various resourcetypes
export default async function cache(c, next) {
  const requestPath = c.req.path;
  if (
    /^\/(authenticate|listen|login|progress|proxy|rescan|stream)(\/|$)/i.test(
      requestPath
    ) ||
    (c.req.method !== "GET" && /^\/image(\/|$)/i.test(requestPath))
  ) {
    c.header("Cache-Control", "private, no-store");
    return next();
  }

  if (
    requestPath.includes("node-music.json") ||
    requestPath.includes("index.html") ||
    requestPath.includes("version") ||
    requestPath.includes("public-key") ||
    requestPath === "/"
  ) {
    c.header("Cache-Control", "public, max-age=0"); // no cache
    c.header("Expires", new Date(Date.now()).toUTCString());
  } else {
    c.header(
      "Cache-Control",
      "public, max-age=31536000, immutable"
    ); // Cache immutable public assets for one year.
    const expires = new Date(Date.now() + 31536000 * 1000);
    c.header("Expires", new Date(expires.getTime()).toUTCString());
  }
  await next();
}
