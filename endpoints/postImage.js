import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import Busboy from "busboy";
import createLogger from "../modules/logger.js";
import validateJwt from "../modules/validateJwt.js";

const logger = createLogger("postImage");
const cacheDir = path.resolve("./public/data/cache");
const maxFileSize = 5 * 1024 * 1024;
const extensionsByMime = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const getImageExtension = async (filePath) => {
  const file = await fs.open(filePath, "r");
  const signature = Buffer.alloc(12);
  try {
    const { bytesRead } = await file.read(signature, 0, signature.length, 0);
    if (
      bytesRead >= 8 &&
      signature.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ) {
      return "png";
    }
    if (bytesRead >= 3 && signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff) {
      return "jpg";
    }
    if (bytesRead >= 6 && ["GIF87a", "GIF89a"].includes(signature.toString("ascii", 0, 6))) {
      return "gif";
    }
    if (
      bytesRead >= 12 &&
      signature.toString("ascii", 0, 4) === "RIFF" &&
      signature.toString("ascii", 8, 12) === "WEBP"
    ) {
      return "webp";
    }
    return null;
  } finally {
    await file.close();
  }
};

export default async function postImage(c) {
  const authorization = c.req.header("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!(await validateJwt(bearerToken || c.req.query("jwt")))) {
    return c.body(null, 401);
  }
  if (!c.req.raw.body) {
    return c.body(null, 400);
  }

  let busboy;
  try {
    busboy = Busboy({
      headers: Object.fromEntries(c.req.raw.headers.entries()),
      limits: { fileSize: maxFileSize, files: 1, fields: 0, parts: 1 },
    });
  } catch (error) {
    logger.warn(`Invalid image upload request: ${error.message}`);
    return c.body(null, 400);
  }

  return new Promise((resolve) => {
    let fileReceived = false;
    let responded = false;
    let uploadError;
    let cacheName;
    const uploads = [];

    const respond = (statusCode, body) => {
      if (responded) {
        return;
      }
      responded = true;
      resolve(
        body !== undefined
          ? c.json(body, statusCode)
          : c.body(null, statusCode)
      );
    };

    busboy.on("file", (_fieldname, file, info) => {
      if (fileReceived) {
        uploadError = new Error("Only one image file may be uploaded");
        file.resume();
        return;
      }
      fileReceived = true;

      const { filename, mimeType } = info;
      const extension = Object.hasOwn(extensionsByMime, mimeType)
        ? extensionsByMime[mimeType]
        : undefined;
      const parsedName =
        typeof filename === "string" ? path.parse(filename) : null;
      if (
        !extension ||
        !parsedName ||
        !/^[A-Za-z0-9_.-]{1,200}$/.test(filename) ||
        parsedName.name === "." ||
        parsedName.name === ".."
      ) {
        uploadError = new Error("Unsupported image name or type");
        file.resume();
        return;
      }

      const temporaryPath = path.join(cacheDir, `.upload-${randomUUID()}`);
      const upload = async () => {
        await fs.mkdir(cacheDir, { recursive: true });
        await pipeline(
          file,
          createWriteStream(temporaryPath, { flags: "wx", mode: 0o600 })
        );
        if (file.truncated) {
          const error = new Error("Image exceeds upload size limit");
          error.statusCode = 413;
          throw error;
        }

        const detectedExtension = await getImageExtension(temporaryPath);
        if (detectedExtension !== extension) {
          const error = new Error("Image content does not match its MIME type");
          error.statusCode = 415;
          throw error;
        }

        cacheName = `${parsedName.name}.${detectedExtension}`;
        await fs.rename(temporaryPath, path.join(cacheDir, cacheName));
      };

      uploads.push(
        upload().catch(async (error) => {
          uploadError ??= error;
          error.statusCode ??= error.code ? 500 : 400;
          logger.warn(`Image upload failed: ${error.message}`);
          try {
            await fs.unlink(temporaryPath);
          } catch (cleanupError) {
            if (cleanupError.code !== "ENOENT") {
              logger.error(
                `Unable to remove temporary upload: ${cleanupError.message}`
              );
            }
          }
        })
      );
    });

    busboy.on("filesLimit", () => {
      uploadError ??= new Error("Only one image file may be uploaded");
    });
    busboy.on("partsLimit", () => {
      uploadError ??= new Error("Too many multipart fields");
    });
    busboy.on("error", async (error) => {
      logger.warn(`Unable to parse image upload: ${error.message}`);
      await Promise.all(uploads);
      respond(400);
    });
    busboy.on("finish", async () => {
      await Promise.all(uploads);
      if (uploadError) {
        logger.warn(`Image upload rejected: ${uploadError.message}`);
        respond(uploadError.statusCode || 400);
        return;
      }
      if (!fileReceived || !cacheName) {
        respond(400);
        return;
      }

      logger.info(`cache file written for ${cacheName}`);
      respond(201, { cachename: cacheName });
    });

    const requestStream = Readable.fromWeb(c.req.raw.body);
    requestStream.on("error", (error) => {
      logger.warn(`Image upload request stream failed: ${error.message}`);
      busboy.destroy(error);
    });
    requestStream.pipe(busboy);
  });
}
