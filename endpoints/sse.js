var logger = require("./../modules/logger")("sse");

module.exports = function (req, res, next) {
    req.app.locals.clients = req.app.locals.clients || [];

    res.header('Content-Type', 'text/event-stream');
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');

    res.connection.setTimeout(0);

    res.write(`data: ${JSON.stringify({ progress: 0, status: "ready" })}\n\n`);

    const clientId = Date.now();

    const newClient = {
        id: clientId,
        res
    };
    req.app.locals.clients.push(newClient);

    req.on('close', () => {
        logger.debug(`SSEclient-${clientId} Connection closed`);
        req.app.locals.clients = req.app.locals.clients.filter(client => client.id !== clientId);
        res.end();
    });
};
