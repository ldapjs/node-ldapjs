///--- Globals

var parseDN = require('./dn').parse;

var EntryChangeNotificationControl =
  require('./controls').EntryChangeNotificationControl;

///--- API

// Cache used to store connected persistent search clients
function PersistentSearch() {
  this.clientList = [];
}


PersistentSearch.prototype.addClient = function (req, res, callback) {
  if (typeof (req) !== 'object')
    throw new TypeError('req must be an object');
  if (typeof (res) !== 'object')
    throw new TypeError('res must be an object');
  if (callback && typeof (callback) !== 'function')
    throw new TypeError('callback must be a function');

  var log = req.log;

  var client = {};
  client.req = req;
  client.res = res;

  log.debug('%s storing client', req.logId);

  this.clientList.push(client);

  log.debug('%s stored client', req.logId);
  log.debug('%s total number of clients %s',
            req.logId, this.clientList.length);
  if (callback)
    callback(client);
};


PersistentSearch.prototype.removeClient = function (req, res, callback) {
  if (typeof (req) !== 'object')
    throw new TypeError('req must be an object');
  if (typeof (res) !== 'object')
    throw new TypeError('res must be an object');
  if (callback && typeof (callback) !== 'function')
    throw new TypeError('callback must be a function');

  var log = req.log;
  log.debug('%s removing client', req.logId);
  var client = {};
  client.req = req;
  client.res = res;

  // remove the client if it exists
  this.clientList.forEach(function (element, index, array) {
    if (element.req === client.req) {
      log.debug('%s removing client from list', req.logId);
      array.splice(index, 1);
    }
  });

  log.debug('%s number of persistent search clients %s',
            req.logId, this.clientList.length);
  if (callback)
    callback(client);
};


function getOperationType(requestType) {
  switch (requestType) {
    case 'AddRequest':
    case 'add':
      return 1;
    case 'DeleteRequest':
    case 'delete':
      return 2;
    case 'ModifyRequest':
    case 'modify':
      return 4;
    case 'ModifyDNRequest':
    case 'modrdn':
      return 8;
    default:
      throw new TypeError('requestType %s, is an invalid request type',
                          requestType);
  }
}


function getEntryChangeNotificationControl(req, obj, callback) {
  // if we want to return a ECNC
  if (req.persistentSearch.value.returnECs) {
    var attrs = obj.attributes;
    var value = {};
    value.changeType = getOperationType(attrs.changetype);
    // if it's a modDN request, fill in the previous DN
    if (value.changeType === 8 && attrs.previousDN) {
      value.previousDN = attrs.previousDN;
    }

    value.changeNumber = attrs.changenumber;
    return new EntryChangeNotificationControl({ value: value });
  } else {
    return false;
  }
}


function checkChangeType(req, requestType) {
  return (req.persistentSearch.value.changeTypes &
          getOperationType(requestType));
}


///--- Exports

module.exports = {
  PersistentSearchCache: PersistentSearch,
  checkChangeType: checkChangeType,
  getEntryChangeNotificationControl: getEntryChangeNotificationControl
};
