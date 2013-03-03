
if (!localStorage) {
  var localStorage = {}; // Fake persistance for node
}

function localStorageWrapper (key) {
  this.key = key;
};

localStorageWrapper.prototype.get = function () {
  if (!localStorage[this.key]) {
    return;
  }

  try {
    return JSON.parse(localStorage[this.key]);
  } catch(e) {
    return localStorage[this.key];
  }

};

localStorageWrapper.prototype.set = function (value) {
  try {
    localStorage[this.key] = (typeof value === "string") ? value : JSON.stringify(value);
  } catch (e){
    console.error("Error Saving to localStorage");
  }
};

localStorageWrapper.prototype.del = function () {
  delete localStorage[this.key];
};
