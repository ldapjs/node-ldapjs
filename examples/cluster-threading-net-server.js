const cluster = require('cluster')
const ldap = require('ldapjs')
const net = require('net')
const os = require('os')

const threads = []
threads.getNext = function () {
  return (Math.floor(Math.random() * this.length))
}

const serverOptions = {
  port: 1389
}

if (cluster.isMaster) {
  const server = net.createServer(serverOptions, (socket) => {
    socket.pause()
    console.log('ldapjs client requesting connection')
    const routeTo = threads.getNext()
    threads[routeTo].send({ type: 'connection' }, socket)
  })

  for (let i = 0; i < os.cpus().length; i++) {
    const thread = cluster.fork({
      id: i
    })
    thread.id = i
    thread.on('message', function () {

    })
    threads.push(thread)
  }

  server.listen(serverOptions.port, function () {
    console.log('ldapjs listening at ldap://127.0.0.1:' + serverOptions.port)
  })
} else {
  const server = ldap.createServer(serverOptions)

  const threadId = process.env.id

  process.on('message', (msg, socket) => {
    switch (msg.type) {
      case 'connection':
        server.newConnection(socket)
        socket.resume()
        console.log('ldapjs client connection accepted on ' + threadId.toString())
    }
  })

  server.search('dc=example', function (req, res) {
    console.log('ldapjs search initiated on ' + threadId.toString())
    const obj = {
      dn: req.dn.toString(),
      attributes: {
        objectclass: ['organization', 'top'],
        o: 'example'
      }
    }

    if (req.filter.matches(obj.attributes)) { res.send(obj) }

    res.end()
  })
}
