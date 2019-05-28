var pjson = require("../package.json");

module.exports = function(req, res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.write(
    JSON.stringify({
      version: pjson.version
    })
  );
  res.end();
};
