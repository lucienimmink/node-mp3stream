var express = require("express"),
  fs = require("fs"),
  walk = require("fs-walk"),
  compression = require("compression"),
  http2 = require("http2e"),
  expressHTTP2Workaround = require("express-http2-workaround"),
  log4js = require("log4js"),
  cors = require("./modules/cors"),
  cache = require("./modules/cache"),
  imageProxy = require("./endpoints/imageProxy"),
  rescan = require("./endpoints/rescan"),
  progress = require("./endpoints/progress"),
  login = require("./endpoints/login"),
  listen = require("./endpoints/listen"),
  config = require("./config.json"),
  ask = require("./modules/ask"),
  askUser = require("./modules/askUser"),
  _ = require("lodash"),
  del = require("delete"),
  symlinkOrCopySync = require("symlink-or-copy").sync,
  package = require("./package.json"),
  app = express();

// set-up main logger
log4js.configure({
  appenders: { app: { type: "file", filename: "logs/mp3stream.log" } },
  categories: { default: { appenders: ["app"], level: "info" } }
});
const logger = log4js.getLogger("app");

// set-up express
app.use(expressHTTP2Workaround({ express: express, http2: http2 }));
app.use(compression());
app.use(cors);
app.use(cache);
app.use(express.static("./public"));

// check if config is set-up if not ask for input
var addUserMode = process.argv[2] === "adduser";
if (addUserMode) {
  askUser();
  return;
}
if (config.ask || !config.path) {
  // ask user to set-up configuration
  ask();
  return;
} else {
  // link website
  if (config.useJSMusicDB) {
    logger.info("Setting up website ...");
    walk.files("node_modules/jsmusicdbnext-prebuilt/", (dir, file) => {
      // link these files
      del.sync("public/" + file);
      symlinkOrCopySync(
        "node_modules/jsmusicdbnext-prebuilt/" + file,
        "public/" + file
      );
      del.sync("public/global");
      symlinkOrCopySync(
        "node_modules/jsmusicdbnext-prebuilt/global",
        "public/global"
      );
    });
  }
  // set-up endpoints
  app.get("/data/image-proxy", imageProxy);
  app.get("/listen", listen);
  app.post("/login", login);
  app.get("/rescan", rescan);
  app.get("/progress", progress);
}

// redirect everything to index if not in predefined list
app.get(
  /^(?!\/rescan|\/listen|\/progress|\/data\/.*|\/dist.*|\/global.*|\/dist-systemjs.*|\/sw.js|\/manifest.json|\/js\/.*|\/app.*|\/css\/.*|\/fonts\/.*|\/fonts\/glyphs\/.*).*$/,
  function(req, res) {
    res.sendFile("public/index.html", { root: __dirname });
  }
);

// start-up express
if (config.useSSL) {
  var privateKey = fs.readFileSync(config.sslKey, "utf8");
  var certificate = fs.readFileSync(config.sslCert, "utf8");
  var credentials = {
    key: privateKey,
    cert: certificate
  };
  var httpsServer = https.createServer(credentials, app);
  httpsServer.listen(config.port);
  logger.info(
    `node mp3stream ${package.version} is set-up and running in http/2 mode`
  );
} else {
  app.listen(config.port);
  logger.info(
    `node mp3stream ${package.version} is set-up and running in http mode`
  );
}
