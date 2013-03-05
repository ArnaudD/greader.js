
/**
 * MemoryStore provides the same API as IDBStore to be easily swappable depending on the environment
 */

greader.MemoryStore = (function () {

  var defaults = {
    storeName: 'Store',
    storePrefix: 'IDBWrapper-',
    dbVersion: 1,
    keyPath: 'id',
    autoIncrement: true,
    onStoreReady: function () {
    },
    onError: function(error){
      throw error;
    },
    indexes: []
  };

  var MemoryStore = function (options, onStoreReady) {

    for(var key in defaults){
      this[key] = typeof options[key] != 'undefined' ? options[key] : defaults[key];
    }

    this.store = {};

    if (onStoreReady) {
      onStoreReady();
    } else {
      this.onStoreReady();
    }

    this._insertIdCount = 0;

  };

  MemoryStore.prototype = {

    deleteDatabase: function () {
      delete this.store;
    },

    put: function (dataObj, onSuccess, onError) {
      onSuccess || (onSuccess = noop);
      if (typeof dataObj[this.keyPath] == 'undefined') {
        dataObj[this.keyPath] = this._getUID();
      }
      this.store[this.keyPath] = dataObj;
      onSuccess(dataObj);
    },

    get: function (key, onSuccess, onError) {
      onSuccess || (onSuccess = noop);
      onSuccess(this.store[key]);
    },

    remove: function (key, onSuccess, onError) {
      onSuccess || (onSuccess = noop);
      delete this.store[key];
      onSuccess();
    },

    batch: function (dataArray, onSuccess, onError) {
      if(Object.prototype.toString.call(dataArray) != '[object Array]'){
        onError(new Error('dataArray argument must be of type Array.'));
      }

      onSuccess || (onSuccess = noop);

      var count  = dataArray.length;
      var called = false;
      var onItemSuccess = function (event) {
        count--;
        if (count === 0 && !called) {
          called = true;
          onSuccess();
        }
      }

      _.each(dataArray, function (operation) {
        var type  = operation.type;
        var key   = operation.key;
        var value = operation.value;

        if (type === "remove") {
          this.remove(key, onItemSuccess);
        } else if (type === "put") {
          this.put(value, onItemSuccess);
        }
      }, this);
    },

    getAll: function (onSuccess, onError) {
      onSuccess(_.values(this.store));
    },

    clear: function (onSuccess, onError) {
      onSuccess || (onSuccess = noop);
      this.store = {};
      onSuccess();
    },

    _getUID: function () {
      return this._insertIdCount++ + Date.now();
    },

    getIndexList: function () {
      return this.store.indexNames;
    }/*,


    hasIndex: function (indexName) {
      return this.store.indexNames.contains(indexName);
    },

    normalizeIndexData: function (indexData) {
      indexData.keyPath = indexData.keyPath || indexData.name;
      indexData.unique = !!indexData.unique;
      indexData.multiEntry = !!indexData.multiEntry;
    },

    indexComplies: function (actual, expected) {
      var complies = ['keyPath', 'unique', 'multiEntry'].every(function (key) {
        // IE10 returns undefined for no multiEntry
        if (key == 'multiEntry' && actual[key] === undefined && expected[key] === false) {
          return true;
        }
        return expected[key] == actual[key];
      });
      return complies;
    },

    iterate: function (onItem, options) {
      options = mixin({
        index: null,
        order: 'ASC',
        filterDuplicates: false,
        keyRange: null,
        writeAccess: false,
        onEnd: null,
        onError: function (error) {
          console.error('Could not open cursor.', error);
        }
      }, options || {});

      var directionType = options.order.toLowerCase() == 'desc' ? 'PREV' : 'NEXT';
      if (options.filterDuplicates) {
        directionType += '_NO_DUPLICATE';
      }

      var cursorTransaction = this.db.transaction([this.storeName], this.consts[options.writeAccess ? 'READ_WRITE' : 'READ_ONLY']);
      var cursorTarget = cursorTransaction.objectStore(this.storeName);
      if (options.index) {
        cursorTarget = cursorTarget.index(options.index);
      }

      var cursorRequest = cursorTarget.openCursor(options.keyRange, this.consts[directionType]);
      cursorRequest.onerror = options.onError;
      cursorRequest.onsuccess = function (event) {
        var cursor = event.target.result;
        if (cursor) {
          onItem(cursor.value, cursor, cursorTransaction);
          cursor['continue']();
        } else {
          if(options.onEnd){
            options.onEnd();
          } else {
            onItem(null);
          }
        }
      };
    },

    query: function (onSuccess, options) {
      var result = [];
      options = options || {};
      options.onEnd = function () {
        onSuccess(result);
      };
      this.iterate(function (item) {
        result.push(item);
      }, options);
    },

    count: function (onSuccess, options) {
      options = mixin({
        index: null,
        keyRange: null
      }, options || {});

      var onError = options.onError || function (error) {
        console.error('Could not open cursor.', error);
      };

      var cursorTransaction = this.db.transaction([this.storeName], this.consts.READ_ONLY);
      var cursorTarget = cursorTransaction.objectStore(this.storeName);
      if (options.index) {
        cursorTarget = cursorTarget.index(options.index);
      }

      var countRequest = cursorTarget.count(options.keyRange);
      countRequest.onsuccess = function (evt) {
        onSuccess(evt.target.result);
      };
      countRequest.onError = function (error) {
        onError(error);
      };
    },

    makeKeyRange: function(options){
      var keyRange,
          hasLower = typeof options.lower != 'undefined',
          hasUpper = typeof options.upper != 'undefined';

      switch(true){
        case hasLower && hasUpper:
          keyRange = this.keyRange.bound(options.lower, options.upper, options.excludeLower, options.excludeUpper);
          break;
        case hasLower:
          keyRange = this.keyRange.lowerBound(options.lower, options.excludeLower);
          break;
        case hasUpper:
          keyRange = this.keyRange.upperBound(options.upper, options.excludeUpper);
          break;
        default:
          throw new Error('Cannot create KeyRange. Provide one or both of "lower" or "upper" value.');
      }

      return keyRange;

    }
*/
  };

  /** helpers **/

  var noop = function () {
  };
  var empty = {};
  var mixin = function (target, source) {
    var name, s;
    for (name in source) {
      s = source[name];
      if (s !== empty[name] && s !== target[name]) {
        target[name] = s;
      }
    }
    return target;
  };

  return MemoryStore;

})(this);