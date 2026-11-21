import createLogger from "./logger.js";

const logger = createLogger("sse-clients");
const clients = new Set();

export const registerSseClient = (client) => {
  clients.add(client);
  return () => clients.delete(client);
};

export const hasSseClients = () => clients.size > 0;

export const publishSse = async (data) => {
  await Promise.all(
    [...clients].map(async (client) => {
      try {
        await client.writeSSE({ event: "message", data });
      } catch (error) {
        logger.debug(`Removing disconnected SSE client: ${error.message}`);
        clients.delete(client);
      }
    })
  );
};
