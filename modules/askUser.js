import prompts from "prompts";
import bcrypt from "bcryptjs";
import SQLiteTagSpawned from "sqlite-tag-spawned";
import createLogger from './logger.js';

const logger = createLogger('ask-user');

export default async function (exit = false, cb) {
  const { proceed } = await prompts({
    type: "confirm",
    name: "proceed",
    message: "Do you want to add a new user?",
    initial: true,
  });
  if (!proceed) {
    if (exit) process.exit(0);
    cb();
  }
  const { username } = await prompts({
    type: "text",
    name: "username",
    message: "What username do you want to use to authenticate?",
  });
  const { password } = await prompts({
    type: "password",
    name: "password",
    message: "What password do you want to use?",
  });
  hash(password, async (hash) => {
    const { query, transaction, close } = SQLiteTagSpawned("./public/data/secure/users.db");
    await query`CREATE TABLE IF NOT EXISTS users (username TEXT, password TEXT)`;
    const populate = transaction();
    populate`INSERT OR REPLACE INTO users VALUES(${username}, ${hash})`;
    await populate.commit();
    logger.info(`User '${username}' added`);
    close();
    if (exit) process.exit(0);
    cb();
  });
};

const hash = (password, cb) => {
  const saltRounds = 10;
  bcrypt.genSalt(saltRounds, function (err, salt) {
    if (err) {
      throw err;
    } else {
      bcrypt.hash(password, salt, function (err, hash) {
        if (err) {
          throw err;
        } else {
          cb(hash);
        }
      });
    }
  });
};
