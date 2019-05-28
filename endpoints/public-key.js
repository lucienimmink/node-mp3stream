var fs = require("fs");

module.exports = function(req, res) {
  const key = fs.readFileSync("./.public-key.json", "utf-8");
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.write(key);
  res.end();
};
