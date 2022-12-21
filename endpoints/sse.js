var logger = require("./../modules/logger")("sse");

module.exports = function (req, res, next) {
    req.app.locals.clients = req.app.locals.clients || [];
    if ("OPTIONS" == req.method) {
        const headers = {
            'Content-Type': 'text/event-stream',

            // cors
            'Access-Control-Allow-Origin': req.headers.origin,
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
        };
        res.writeHead(200, headers);
        res.sendStatus(200);
        return;
    }
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        // cors
        'Access-Control-Allow-Origin': req.headers.origin,
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Connection, Cache-Control, Pragma',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };
    res.writeHead(200, headers);
    res.connection.setTimeout(0); // disable timeout; clients will be allowed to remain connected indefinitely
    // const data = `data: ${JSON.stringify(facts)}\n\n`;

    // response.write(data);

    res.write(`data: SSE connection opened\n\n`);

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
