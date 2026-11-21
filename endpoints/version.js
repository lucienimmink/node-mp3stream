import pjson from "../package.json" with { type: "json" };

export default function version(c) {
  return c.json({
    version: pjson.version,
  });
}