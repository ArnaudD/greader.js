
if (typeof exports !== 'undefined') {
  if (typeof module !== 'undefined' && module.exports) {
    exports = module.exports = greader;
  }
  exports.greader = greader;
} else {
  this.greader = greader; // this == window
}

if (!_ && require) {
  var _ = require('underscore');
  _.string = require('underscore.string');
}

if (!XMLHttpRequest) {
  var XMLHttpRequest = require('xhr2');
}

if (!async && require) {
  var async = require('async');
}

_.mixin(_.string.exports());
_.string.include('Underscore.string', 'string'); // => true
