import fs from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import validateJwt from "./../modules/validateJwt.js";
import createLogger from "./../modules/logger.js";

const logger = createLogger("listen");

const isWithin = (root, target) => {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
};

const getMimeType = (filePath) => {
  switch (path.extname(filePath).toLowerCase()) {
    case ".flac":
      return "audio/flac";
    case ".m4a":
      return "audio/mp4a-latm";
    case ".wav":
      return "audio/wav";
    case ".ogg":
      return "audio/ogg";
    case ".opus":
      return "audio/opus";
    case ".mp3":
    default:
      return "audio/mpeg";
  }
};

const streamFile = (filePath, c, range) => {
  const streamFileWithStatus = (status, options, headers) => {
    const stream = fs.createReadStream(filePath, options);
    stream.on("error", (error) => {
      logger.error(`Unable to stream ${filePath}: ${error.message}`);
    });
    return c.body(Readable.toWeb(stream), status, headers);
  };

  return stat(filePath).then((fileStat) => {
    if (!fileStat.isFile()) {
      return c.body(null, 404);
    }

    const mime = getMimeType(filePath);
    if (!range) {
      return streamFileWithStatus(
        200,
        undefined,
        {
          "Content-Type": mime,
          "Content-Length": String(fileStat.size),
        }
      );
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) {
      return c.body(null, 416, {
        "Content-Range": `bytes */${fileStat.size}`,
      });
    }

    const start = match[1] ? Number(match[1]) : null;
    const requestedEnd = match[2] ? Number(match[2]) : null;
    if (
      (start !== null && !Number.isSafeInteger(start)) ||
      (requestedEnd !== null && !Number.isSafeInteger(requestedEnd))
    ) {
      return c.body(null, 416, {
        "Content-Range": `bytes */${fileStat.size}`,
      });
    }
    const rangeStart =
      start === null ? Math.max(fileStat.size - requestedEnd, 0) : start;
    const rangeEnd =
      start === null || requestedEnd === null
        ? fileStat.size - 1
        : Math.min(requestedEnd, fileStat.size - 1);
    if (
      !Number.isSafeInteger(rangeStart) ||
      !Number.isSafeInteger(rangeEnd) ||
      rangeStart < 0 ||
      rangeStart >= fileStat.size ||
      rangeEnd < rangeStart
    ) {
      return c.body(null, 416, {
        "Content-Range": `bytes */${fileStat.size}`,
      });
    }

    const chunkSize = rangeEnd - rangeStart + 1;
    return streamFileWithStatus(
      206,
      { start: rangeStart, end: rangeEnd },
      {
        "Content-Range": `bytes ${rangeStart}-${rangeEnd}/${fileStat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": mime,
      }
    );
  });
};

export default async function listen(c) {
  const musicRoot = process.env.MUSICPATH;
  if (!musicRoot) {
    logger.error("Configuration is not complete");
    return c.body(null, 500);
  }

  const requestPath = c.req.query("path");
  if (
    !requestPath ||
    requestPath.length > 4096 ||
    requestPath.includes("\0") ||
    requestPath.includes("\\")
  ) {
    return c.body(null, 400);
  }
  if (!(await validateJwt(c.req.query("jwt")))) {
    logger.warn("User not authorized");
    return c.body(null, 401);
  }

  const rootPath = path.resolve(musicRoot);
  const requestedPath = path.resolve(
    rootPath,
    requestPath.replace(/^\/+/, "")
  );

  let realRoot;
  try {
    realRoot = await realpath(rootPath);
  } catch (error) {
    logger.error(`Unable to resolve music directory: ${error.message}`);
    return c.body(null, 500);
  }

  let realFilePath;
  try {
    realFilePath = await realpath(requestedPath);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      return c.body(null, 404);
    }
    logger.error(`Unable to resolve requested music file: ${error.message}`);
    return c.body(null, 500);
  }
  if (!isWithin(realRoot, realFilePath)) {
    logger.warn("Rejected music path outside configured directory");
    return c.body(null, 403);
  }

  try {
    return await streamFile(realFilePath, c, c.req.header("range"));
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      return c.body(null, 404);
    }
    logger.error(`Unable to read music file: ${error.message}`);
    return c.body(null, 500);
  }
}
