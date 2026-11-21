const defaultOrigins = ["https://www.jsmusicdb.com", "https://jsmusicdb.com", "http://localhost:5173"];

export default async function (c, next) {
  const allowedOrigins = new Set(
    (process.env.CORS_ORIGINS || defaultOrigins.join(","))
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
  const origin = c.req.header("origin");
  const isAllowed = origin && allowedOrigins.has(origin);

  if (isAllowed) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Vary", "Origin", { append: true });
  }
  c.header("Access-Control-Allow-Methods", "GET, POST");
  c.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Content-Length, X-Requested-With, X-Cred"
  );
  if (c.req.method === "OPTIONS") {
    if (!isAllowed) {
      return c.body(null, 403);
    }
    return c.body(null, 200);
  }

  await next();
}
