var logger = require("./../modules/logger")("sse");

module.exports = function (req, res, next) {
    req.app.locals.clients = req.app.locals.clients || [];
    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        // cors
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Connection, Cache-Control, Pragma, cache-control',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
    };
    res.writeHead(200, headers);
    if ("OPTIONS" == req.method) {
        res.sendStatus(200);
    }

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
    });
};