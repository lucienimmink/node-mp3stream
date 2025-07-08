import dotenv from 'dotenv';
dotenv.config();

import fs from 'node:fs';
import http from 'node:http';
import express from 'express';
import compression from 'compression';
import bodyParser from 'body-parser';
import cors from './modules/cors.js';
import cache from './modules/cache.js';
import security from './modules/security.js';
import crypto from './modules/crypto.js';
import rescan from './endpoints/rescan.js';
import progress from './endpoints/progress.js';
import login from './endpoints/login.js';
import listen from './endpoints/listen.js';
import version from './endpoints/version.js';
import publicKey from './endpoints/public-key.js';
import authenticate from './endpoints/authenticate.js';
import getImage from './endpoints/getImage.js';
import postImage from './endpoints/postImage.js';
import proxy from './endpoints/proxy.js';
import sse from './endpoints/sse.js';
import ask from './modules/ask.js';
import askUser from './modules/askUser.js';
import pkg from './package.json' with { type: 'json' };
import createLogger from './modules/logger.js';

const app = express();
const logger = createLogger("app");

if (!crypto.doKeysExist()) {
  crypto.generateKeys();
}

// set-up express
app.use(compression({
  filter: function (req, res) {
    // don't compress an eventstream (content-type: text/event-stream)
    if (res.getHeader('Content-Type')?.includes('text/event-stream')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));
app.use(cors);
app.use(security);
app.use(cache);
app.use('/data', (req, res, next) => {
  var result = req.url.match(/^\/secure\/.+$/);
  if (result) {
    return res.status(403).end('403 Forbidden');
  }
  next();
});
app.use(express.static("./public"));
// app.use([/^\/public\/data\/secure($|\/)/, '/public'], express.static('./public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.disable("x-powered-by");

const startup = () => {
  // set-up endpoints
  app.get("/listen", listen);
  app.post("/login", login);
  app.get("/rescan", rescan);
  app.get("/progress", progress);
  app.get("/version", version);
  app.get("/public-key", publicKey);
  app.post("/authenticate", authenticate);
  app.get("/image", getImage);
  app.post("/image", postImage);
  app.get("/proxy", proxy);
  app.get("/stream", sse);

  // start-up express
  if (process.env.USESSL === "true") {
    var privateKey = fs.readFileSync(process.env.SSLKEY, "utf8");
    var certificate = fs.readFileSync(process.env.SSLCERT, "utf8");
    var credentials = {
      key: privateKey,
      cert: certificate,
    };
    var httpsServer = http.createServer(credentials, app);
    httpsServer.listen(process.env.PORT);
    logger.info(
      `node mp3stream ${pkg.version} is set-up and running in http/2 mode`
    );
  } else {
    const server = app.listen(process.env.PORT);
    logger.info(
      `node mp3stream ${pkg.version} is set-up and running in http mode`
    );
  }
};

// if no db = clean set-up = create clean db
var addUserMode = process.argv[2] === "adduser";
if (addUserMode) {
  askUser(true);
} else {
  // check if we have a .env file; if not create it
  if (!fs.existsSync("./.env")) {
    logger.info("no .env file found; ask for the questions");
    ask();
  }
  // now we have the process.env variables we need!
  if (process.env.USEJSMUSICDB) {
    logger.info(
      "Visit https://www.jsmusicdb.com and use this server as back-end"
    );
  }
  const dir = './public/data/secure/';
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
