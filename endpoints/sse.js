var logger = require("./../modules/logger")("sse");

module.exports = function (req, res, next) {
    req.app.locals.clients = req.app.locals.clients || [];

    res.header('Content-Type', 'text/event-stream');
    res.header('Cache-Control', 'no-cache');

    res.connection.setTimeout(0);

    res.write(`data: ${JSON.stringify({ progress: 0, status: "ready" })}\n\n`);

    const clientId = Date.now();

    const newClient = {
        id: clientId,
        res
    };
    req.app.locals.clients.push(newClient);

    req.on('close', () => {
        logger.info(`SSEclient-${clientId} Connection closed`);
        req.app.locals.clients = req.app.locals.clients.filter(client => client.id !== clientId);
        res.end();
    });
};
