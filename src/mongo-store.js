
/**
 * MongoStore provides the same API as IDBStore to be easily swappable depending on the environment
 */

var MongoStore = function (config) {
  var that = this;
  this._config = config;

  MongoStore._client.open(function(err, p_client) {
    MongoStore._client.collection(config.storeName, function (err, collection) {
      that._collection = collection;
      that._config.onStoreReady();
    });
  });
}

MongoStore.setClient = function (client) {
  this._client = client
}

MongoStore.prototype.put = function (obj, successCb, errorCb) {
  this._collection.insert(obj, function (err, docs) {
    if (err) {
      errorCb(err);
    }
    else {
      successCb(docs[0]);
    }
  });
};

MongoStore.prototype.get = function (id, successCb, errorCb) {
  var query = {};
  query[this._config.keyPath] = id;

  this._collection.findOne(query, function (err, doc) {
    if (err) {
      errorCb(err);
    }
    else {
      successCb(doc);
    }
  });
};

var mongo = require('mongodb')

MongoStore.setClient(new mongo.Db('greader', new mongo.Server("127.0.0.1", 27017, {}), {w: 1}));

