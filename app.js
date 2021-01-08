require("dotenv").config();

var express = require("express"),
  fs = require("fs"),
  compression = require("compression"),
  http2 = require("http2e"),
  expressHTTP2Workaround = require("express-http2-workaround"),
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
  ask = require("./modules/ask"),
  askUser = require("./modules/askUser"),
  package = require("./package.json"),
  app = express(),
  socket = require("./endpoints/socket"),
  logger = require("./modules/logger")("app");

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

const startup = () => {
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
  let io;
  if (process.env.USESSL === "true") {
    var privateKey = fs.readFileSync(process.env.SSLKEY, "utf8");
    var certificate = fs.readFileSync(process.env.SSLCERT, "utf8");
    var credentials = {
      key: privateKey,
      cert: certificate,
    };
    var httpsServer = http2.createServer(credentials, app);
    httpsServer.listen(process.env.PORT);
    logger.info(
      `node mp3stream ${package.version} is set-up and running in http/2 mode`
    );
    io = require("socket.io")(httpsServer);
  } else {
    const server = app.listen(process.env.PORT);
    io = require("socket.io")(server);
    logger.info(
      `node mp3stream ${package.version} is set-up and running in http mode`
    );
  }
  socket(io);
};

// if no db = clean set-up = create clean db
// afterwards start 'the rest'
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
  if (!fs.existsSync("./users.db")) {
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
