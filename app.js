import dotenv from "dotenv";
dotenv.config();

import fs from "node:fs";
import https from "node:https";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { compress } from "hono/compress";
import authenticate from "./endpoints/authenticate.js";
import getImage from "./endpoints/getImage.js";
import listen from "./endpoints/listen.js";
import login from "./endpoints/login.js";
import postImage from "./endpoints/postImage.js";
import progress from "./endpoints/progress.js";
import proxy from "./endpoints/proxy.js";
import publicKey from "./endpoints/public-key.js";
import rescan from "./endpoints/rescan.js";
import sse from "./endpoints/sse.js";
import version from "./endpoints/version.js";
import ask from "./modules/ask.js";
import askUser from "./modules/askUser.js";
import cache from "./modules/cache.js";
import cors from "./modules/cors.js";
import crypto from "./modules/crypto.js";
import createLogger from "./modules/logger.js";
import getJwtSecret from "./modules/jwtSecret.js";
import security from "./modules/security.js";
import pkg from "./package.json" with { type: "json" };

const app = new Hono();
const logger = createLogger("app");

if (!crypto.doKeysExist()) {
  crypto.generateKeys();
}

app.use("*", compress());
app.use("*", cors);
app.use("*", security);
app.use("*", cache);
app.use("*", async (c, next) => {
  if (/^\/data\/secure(?:\/|$)/.test(c.req.path)) {
    return c.text("403 Forbidden", 403);
  }
  await next();
});
app.use("*", serveStatic({ root: "./public" }));

app.post(
  "/authenticate",
  bodyLimit({
    maxSize: 100 * 1024,
    onError: (c) => c.body(null, 413),
  }),
  authenticate
);
app.post("/login", login);
app.get("/listen", listen);
app.get("/rescan", rescan);
app.get("/progress", progress);
app.get("/version", version);
app.get("/public-key", publicKey);
app.get("/image", getImage);
app.post("/image", postImage);
app.get("/proxy", proxy);
app.get("/stream", sse);

app.notFound((c) => c.text("Not Found", 404));
app.onError((error, c) => {
  logger.error(`Unhandled application error: ${error.message}`);
  return c.text("Internal Server Error", 500);
});

const startup = () => {
  getJwtSecret();
  const port = Number(process.env.PORT || 16882);

  if (process.env.USESSL === "true") {
    const serverOptions = {
      key: fs.readFileSync(process.env.SSLKEY, "utf8"),
      cert: fs.readFileSync(process.env.SSLCERT, "utf8"),
    };
    serve(
      {
        fetch: app.fetch,
        port,
        createServer: https.createServer,
        serverOptions,
      },
      (address) => {
        logger.info(
          `node mp3stream ${pkg.version} is running with HTTPS on port ${address.port}`
        );
      }
    );
    return;
  }

  serve(
    { fetch: app.fetch, port },
    (address) => {
      logger.info(
        `node mp3stream ${pkg.version} is running with HTTP on port ${address.port}`
      );
    }
  );
};

const addUserMode = process.argv[2] === "adduser";
if (addUserMode) {
  askUser(true);
} else {
  if (!fs.existsSync("./.env")) {
    logger.info("no .env file found; ask for the questions");
    ask();
  }
  if (process.env.USEJSMUSICDB) {
    logger.info(
      "Visit https://www.jsmusicdb.com and use this server as back-end"
    );
  }
  const dir = "./public/data/secure/";
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  if (!fs.existsSync(`${dir}users.db`)) {
    console.log("focus on the terminal :)");
    askUser(false, () => {
      logger.info("user db has been created; now start-up");
      startup();
    });
  } else {
    logger.info("user db present; now start-up");
    startup();
  }
}
