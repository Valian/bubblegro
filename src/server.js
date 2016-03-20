var express = require('express');
var http = require('http');
var ioServer = require('./socket');
var _ = require('lodash');
var AllegroClient = require('./allegro/client');

var app = new express();
var server = http.createServer(app);
var port = 3000;
var io = ioServer.serverInit(server);

var options = {
    key: process.env.KEY,
    login: process.env.LOGIN,
    passwordHash: process.env.PASS,
    wsdl: 'https://webapi.allegro.pl/service.php?wsdl',
    countryId: 1 //Poland
};

if(!options.key || !options.passwordHash || !options.login){
    console.log('Please provide credentials to Allegro API by setting envrionment variables: KEY, PASS and LOGIN');
    process.exit();
}

app.use(express.static((__dirname + '/static')))
app.use('/', function(req, res) {
    res.sendFile(__dirname + '/static/index.html')
})

server.listen(port, '0.0.0.0', function(error) {
    if (error) {
        console.error(error)
    } else {
        console.info("==> 🌎  Listening on port %s. Open up http://localhost:%s/ in your browser.", port, port)
    }
})

AllegroClient.createClient(options, 'start', (err, client) => {
    if (err) {
        console.log(`Error when creating Allegro Client!: ${err}`);
    } else {
        console.log('Allegro Client successfully initialized!');
        client.startPooling(io);
    }
});
