require("dotenv").config();

var express = require("express"),
  fs = require("fs"),
  walk = require("fs-walk"),
  compression = require("compression"),
  http2 = require("http2e"),
  expressHTTP2Workaround = require("express-http2-workaround"),
  log4js = require("log4js"),
  bodyParser = require("body-parser"),
  cors = require("./modules/cors"),
  cache = require("./modules/cache"),
  security = require("./modules/security"),
  crypto = require("./modules/crypto"),
  imageProxy = require("./endpoints/imageProxy"),
  rescan = require("./endpoints/rescan"),
  progress = require("./endpoints/progress"),
  login = require("./endpoints/login"),
  listen = require("./endpoints/listen"),
  version = require("./endpoints/version"),
  publicKey = require("./endpoints/public-key"),
  authenticate = require("./endpoints/authenticate"),
  config = require("./config.json"),
  ask = require("./modules/ask"),
  askUser = require("./modules/askUser"),
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

if (!crypto.doKeysExist()) {
  crypto.generateKeys();
}

// set-up express
app.use(expressHTTP2Workaround({ express: express, http2: http2 }));
app.use(compression());
app.use(cors);
app.use(security);
app.use(cache);
app.use(express.static("./public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.disable("x-powered-by");

// check if config is set-up if not ask for input
var addUserMode = process.argv[2] === "adduser";
if (addUserMode) {
  askUser();
}
// check if we have a .env file; if not create it
if (!fs.existsSync("./.env")) {
  logger.info("no .env file found; ask for the questions");
  ask();
}
// now we have the process.env variables we need!
if (process.env.USEJSMUSICDB) {
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
app.get("/version", version);
app.get("/public-key", publicKey);
app.post("/authenticate", authenticate);

// start-up express
if (process.env.USESSL === "true") {
  var privateKey = fs.readFileSync(process.env.SSLKEY, "utf8");
  var certificate = fs.readFileSync(process.env.SSLCERT, "utf8");
  var credentials = {
    key: privateKey,
    cert: certificate
  };
  var httpsServer = http2.createServer(credentials, app);
  httpsServer.listen(process.env.PORT);
  logger.info(
    `node mp3stream ${package.version} is set-up and running in http/2 mode`
  );
} else {
  app.listen(process.env.PORT);
  logger.info(
    `node mp3stream ${package.version} is set-up and running in http mode`
  );
}
