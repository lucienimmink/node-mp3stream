import { streamSSE } from "hono/streaming";
import { registerSseClient } from "../modules/sseClients.js";

export default function sse(c) {
  return streamSSE(c, async (stream) => {
    const unregister = registerSseClient(stream);
    try {
      await stream.writeSSE({
        data: JSON.stringify({ progress: 0, status: "ready" }),
      });
      await new Promise((resolve) => stream.onAbort(resolve));
    } finally {
      unregister();
    }
  });
}
