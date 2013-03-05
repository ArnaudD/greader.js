
(function (root) {

  var GReaderStore, initializedStores = 0, onStoreReady;

  if (root.indexedDB || root.webkitIndexedDB || root.mozIndexedDB) {
    GReaderStore = IDBStore;
  }
  else {
    GReaderStore = greader.MemoryStore;
  }

  // TODO mongo store

  onStoreReady = function () {
    initializedStores++;
    if (initializedStores === 3) {
      greader._onStoreReady();
    }
  };

  greader.stores = {

    user:  new GReaderStore({
      dbVersion: 1,
      storeName: 'user',
      keyPath: 'name',
      autoIncrement: false,
      onStoreReady: onStoreReady
    }),

    feeds: new GReaderStore({
      dbVersion: 1,
      storeName: 'feeds',
      onStoreReady: onStoreReady
    }),

    items: new GReaderStore({
      dbVersion: 1,
      storeName: 'items',
      onStoreReady: onStoreReady
    })

  };

})(this);
