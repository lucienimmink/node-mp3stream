import { lookup } from "node:dns/promises";
import https from "node:https";
import http from "node:http";
import { BlockList, isIP } from "node:net";
import createLogger from "../modules/logger.js";
import validateJwt from "../modules/validateJwt.js";

const logger = createLogger("proxy");
const maxResponseSize = 5 * 1024 * 1024;
const blockedAddresses = new BlockList();
const globalIPv6Addresses = new BlockList();

[
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
].forEach(([address, prefix]) => {
  blockedAddresses.addSubnet(address, prefix, "ipv4");
});

[
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
].forEach(([address, prefix]) => {
  blockedAddresses.addSubnet(address, prefix, "ipv6");
});
globalIPv6Addresses.addSubnet("2000::", 3, "ipv6");

const isPublicAddress = ({ address, family }) => {
  if (family === 4) {
    return !blockedAddresses.check(address, "ipv4");
  }
  return (
    family === 6 &&
    globalIPv6Addresses.check(address, "ipv6") &&
    !blockedAddresses.check(address, "ipv6")
  );
};

const resolvePublicHost = async (hostname) => {
  const ipVersion = isIP(hostname);
  const addresses = ipVersion
    ? [{ address: hostname, family: ipVersion }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) {
    throw Object.assign(new Error("Proxy target resolves to a restricted address"), {
      statusCode: 400,
    });
  }
  return addresses;
};

const requestRemote = (url, addresses) =>
  new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.get(
      url,
      {
        lookup: (_hostname, options, callback) => {
          if (options?.all) {
            callback(null, addresses);
          } else {
            callback(null, addresses[0].address, addresses[0].family);
          }
        },
      },
      resolve
    );
    request.setTimeout(10000, () => {
      request.destroy(new Error("Proxy request timed out"));
    });
    request.on("error", reject);
  });

const fetchImage = async (remote) => {
  if (typeof remote !== "string" || remote.length > 2048) {
    throw Object.assign(new Error("Invalid proxy target"), { statusCode: 400 });
  }

  let url;
  try {
    url = new URL(remote);
  } catch {
    throw Object.assign(new Error("Invalid proxy target"), { statusCode: 400 });
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    (url.port &&
      !(
        (url.protocol === "http:" && url.port === "80") ||
        (url.protocol === "https:" && url.port === "443")
      ))
  ) {
    throw Object.assign(new Error("Unsupported proxy target"), { statusCode: 400 });
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await resolvePublicHost(hostname);
  const response = await requestRemote(url, addresses);
  if (response.statusCode !== 200) {
    response.resume();
    throw Object.assign(new Error("Remote server returned an error"), {
      statusCode: 502,
    });
  }

  const contentType = response.headers["content-type"]?.split(";")[0].trim();
  if (
    !contentType ||
    !/^image\/(jpeg|png|gif|webp|avif|bmp|tiff|x-icon)$/.test(contentType)
  ) {
    response.resume();
    throw Object.assign(new Error("Remote response is not a supported image"), {
      statusCode: 415,
    });
  }
  const contentLength = Number(response.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > maxResponseSize) {
    response.destroy();
    throw Object.assign(new Error("Remote image exceeds size limit"), {
      statusCode: 413,
    });
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of response) {
    size += chunk.length;
    if (size > maxResponseSize) {
      response.destroy();
      throw Object.assign(new Error("Remote image exceeds size limit"), {
        statusCode: 413,
      });
    }
    chunks.push(chunk);
  }
  return { body: Buffer.concat(chunks), contentType };
};

export default async function proxy(c) {
  if (!(await validateJwt(c.req.query("jwt")))) {
    return c.body(null, 401);
  }

  try {
    const { body, contentType } = await fetchImage(c.req.query("remote"));
    return c.body(new Uint8Array(body), 200, {
      "Content-Type": contentType,
      "Content-Length": String(body.length),
      "X-Content-Type-Options": "nosniff",
    });
  } catch (error) {
    logger.warn(`Proxy request failed: ${error.message}`);
    return c.body(null, error.statusCode || 502);
  }
}
