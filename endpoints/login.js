import validateJwt from "./../modules/validateJwt.js";
import createLogger from "./../modules/logger.js";

const logger = createLogger("login");
const validCallback = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;

export default async function login(c) {
  logger.info("Starting authentication");
  const token = c.req.header("x-cred");
  if (!token) {
    return c.body(null, 401);
  }

  const result = { success: await validateJwt(token) };
  const callback = c.req.query("callback");
  if (!callback) {
    return c.json(result);
  }
  if (!validCallback.test(callback)) {
    return c.body(null, 400);
  }

  const jsonp = `/**/ typeof ${callback} === 'function' && ${callback}(${JSON.stringify(result)});`;
  return c.text(jsonp, 200, {
    "Content-Type": "application/javascript; charset=utf-8",
  });
}
