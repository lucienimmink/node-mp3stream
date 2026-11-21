const extensions = [".css", ".png", ".gif", ".jpg", ".webp", ".ico", ".js"];

export default async function security(c, next) {
  await next();

  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security
  if (process.env.USESSL === "true") {
    c.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options
  extensions.forEach(function(extension) {
    if (c.req.url.indexOf(extension) !== -1) {
      c.header("X-Content-Type-Options", "nosniff");
    }
  });

  // override mime-types
  if (c.req.url.indexOf(".js") !== -1) {
    c.header("Content-Type", "text/javascript; charset=utf-8");
  }
  if (c.req.url.indexOf(".webmanifest") !== -1) {
    c.header("Content-Type", "application/manifest+json; charset=utf-8");
  }
}
