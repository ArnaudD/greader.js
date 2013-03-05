
greader.js
==========

Unofficial Google Reader Javascript API.

Fork of https://github.com/Tibfib/Google-Reader-Library or Node.js and the browser (WebApps with cross domain XHR enabled)

**WIP**

Install
-------

    # download
    $ npm install ArnaudD/greader.js

    # build
    $ grunt

Browser dependencies
--------------------

* underscore
* underscore.string
* async


Basic Usage
-----------

    var greader = require('./greader');

    greader.login('user@gmail.com', 'password', function (user) {
      console.log(user);
      greader.loadFeeds(function (feeds) {
        console.log(feeds);
      });

    },function () {
      console.log('error !');
    })