const cluster = require('cluster');
const ldap = require('ldapjs');
const os = require('os');

const threads = [];
threads.getNext = function () {
    return (Math.floor(Math.random() * this.length));
};

const serverOptions = {
    connectionRouter: (socket) => {
        socket.pause();
        console.log('ldapjs client requesting connection');
        let routeTo = threads.getNext();
        threads[routeTo].send({ type: 'connection' }, socket);
    }
};

const server = ldap.createServer(serverOptions);

if (cluster.isMaster) {
    for (let i = 0; i < os.cpus().length; i++) {
        let thread = cluster.fork({
            'id': i
        });
        thread.id = i;
        thread.on('message', function (msg) {

        });
        threads.push(thread);
    }

    server.listen(1389, function () {
        console.log('ldapjs listening at ' + server.url);
    });
} else {
    let threadId = process.env.id;
    serverOptions.connectionRouter = (connection) => {
        console.log('should not be hit');
    };

    process.on('message', (msg, socket) => {
        switch (msg.type) {
            case 'connection':
                server.newConnection(socket);
                socket.resume();
                console.log('ldapjs client connection accepted on ' + threadId.toString());
        }
    });

    server.search('dc=example', function (req, res, next) {
        console.log('ldapjs search initiated on ' + threadId.toString());
        var obj = {
            dn: req.dn.toString(),
            attributes: {
                objectclass: ['organization', 'top'],
                o: 'example'
            }
        };

        if (req.filter.matches(obj.attributes))
            res.send(obj);

        res.end();
    });
}
