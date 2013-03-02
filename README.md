
greader.js
==========

Unofficial Google Reader Javascript API.

Fork of https://github.com/Tibfib/Google-Reader-Library or Node.js and the browser (WebApp with CORS disabled)

**WIP**

Basic Usage
-----------

    var greader = require('./greader');

    greader.login('user@gmail.com', 'password', function () {
      console.log(greader.getUser());
      greader.loadFeeds(function (feeds) {
        console.log(feeds);
      });

    },function () {
      console.log('error !');
    })