var Server = require('socket.io')

module.exports.serverInit = function startServer(app) {
    const io = new Server(app);

    io.on('connection', (socket) => {
        console.log('Someone connected!')
    });

    return io;
}
