
if (typeof exports !== 'undefined') {
  if (typeof module !== 'undefined' && module.exports) {
    exports = module.exports = greader;
  }
  exports.greader = greader;

  if (!_) {
    var _ = require('underscore');
    _.string = require('underscore.string')
  };

  if (!XMLHttpRequest) {
    var XMLHttpRequest = require('xhr2');
  }

  if (!async) {
    var async = require('async');
  }

}
else {
  this.greader = greader; // this == window
}

_.mixin(_.string.exports());
_.string.include('Underscore.string', 'string');
