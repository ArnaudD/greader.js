(function() {

//constants that will only be used in this file
var LOGIN_URL             = "https://www.google.com/accounts/ClientLogin",
    BASE_URL              = "http://www.google.com/reader/api/0/",
    PREFERENCES_PATH      = "preference/stream/list",
    STREAM_PATH           = "stream/contents/",
    SUBSCRIPTIONS_PATH    = "subscription/",
    TAGS_PATH             = "tag/",
    LIST_SUFFIX           = "list",
    EDIT_SUFFIX           = "edit",
    MARK_ALL_READ_SUFFIX  = "mark-all-as-read",
    TOKEN_SUFFIX          = "token",
    USERINFO_SUFFIX       = "user-info",
    UNREAD_SUFFIX         = "unread-count",
    RENAME_LABEL_SUFFIX   = "rename-tag",
    EDIT_TAG_SUFFIX       = "edit-tag",

    readerFeeds = [],
    readerAuth  = new localStorageWrapper("Auth"),
    readerUser  = new localStorageWrapper("User"),
    readerToken = "",
    requests    = [],
    greader;


greader = {
  CLIENT: 'greader.js',
  TAGS: {
    "like": "user/-/state/com.google/like",
    "label": "user/-/label/",
    "star": "user/-/state/com.google/starred",
    "read": "user/-/state/com.google/read",
    "fresh": "user/-/state/com.google/fresh",
    "share": "user/-/state/com.google/broadcast",
    "kept-unread": "user/-/state/com.google/kept-unread",
    "reading-list": "user/-/state/com.google/reading-list"
  },
  has_loaded_prefs: false
};


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


var makeQueryString = function (obj) {
  var params = [], key, queryString;
  
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      if(key === "set"){
        //for some requests, you can send the same keys sequentially ex: ?i=2&s=dog&i=4&s=cat ...
        //we support this, but you have to pass the keys that get listed multiple times as a set array of objects.
        //set: [{i: 2, s: "dog"}, {i: 4, s: "cat"}];
        _.each(obj[key], function(singleSet){
          makeQueryString(singleSet);
        });
      } else {
        params.push(encodeURIComponent(key) + "=" + encodeURIComponent(obj[key]));        
      }
    }
  }

  return params.join("&")
};

var onReadyStateChange = function (requestIndex, obj) {
  if ((this.readyState === 4) && this.status === 200) {
    if (obj.onSuccess) {
      obj.onSuccess(this);
      if (requests[requestIndex]) {
        delete requests[requestIndex];
      }
    }
  } else if (this.readyState === 4) {
    if (obj.method === "POST") {
      if (!obj.tried) {
        //If it failed and this is a post request, try getting a new token, then do the request again
        greader.user.getToken(function () {
          obj.tried = true;
          makeRequest(obj);
          if (requests[requestIndex]) {
            delete requests[requestIndex];
          }
        }, obj.onFailure);
      }
    } else {
      if (obj.onFailure) {
        obj.onFailure(this);
        if (requests[requestIndex]) {
          delete requests[requestIndex];
        }
      }
    }
    if (this.status === 401 && this.statusText === "Unauthorized") {
      //This probably means your Auth expired. The user needs to log in again.
      console.error("AUTH EXPIRED? TRY LOGGING IN AGAIN");
    }

    console.error("Request Failed: " + this);
  }
}

var makeRequest = function (obj, noAuth) {
  var url, request, queryString;

  // Make sure we have a method and a parameters object
  obj.method     = obj.method || "GET";
  obj.parameters = obj.parameters || {};

  // Add the necessary parameters to get our requests to function properly
  if (obj.method === "GET") {
    obj.parameters.ck          = Date.now() || new Date().getTime();
    obj.parameters.accountType = "GOOGLE";
    obj.parameters.service     = "reader";
    obj.parameters.output      = "json"; 
    obj.parameters.client      = "greader.js";
  }

  // If we have a token, add it to the parameters.
  // It seems that "GET" requests don't care about your token
  if (readerToken && obj.method === "POST") {
    obj.parameters.T = readerToken;     
  }
  
  // Turn our parameters object into a query string
  queryString = makeQueryString(obj.parameters);
  
  url = obj.url + "?";
  url += (obj.method === "GET") ? queryString : ("client=" + encodeURIComponent(CLIENT));
    
  request = new XMLHttpRequest();
  request.open(obj.method, url, true);
  request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
  request.setRequestHeader('Cookie', '');

  if (readerAuth.get() && !noAuth) {
    request.setRequestHeader("Authorization", "GoogleLogin auth=" + readerAuth.get());
  }

  request.onreadystatechange = _.bind(onReadyStateChange, request, requests.length, obj);;
  request.send((obj.method === "POST") ? queryString : "");
  requests.push(request);
}; // makeRequest()


var User;

User = {

  isAuth: function () {
    if(readerAuth.get()){
      return true;
    }
  },

  login: function (email, password, successCallback, failCallback) {
    if (email.length === 0 || password.length === 0) {
      failCallback("Blank Info...");
      return;
    }
    makeRequest({
      method: "GET",
      url: LOGIN_URL,
      parameters: {Email: email, Passwd: password},
      onSuccess: function (transport) {
        readerAuth.set(_.lines(transport.responseText)[2].replace("Auth=", ""));
        User.load(successCallback, failCallback);
      },
      onFailure: function (transport) {
        console.error(transport);
        failCallback(greader.normalizeError(transport.responseText));
      }
    });
  },

  logout: function () {
    readerAuth.del();
    readerUser.del();
    greader.setFeeds([]);
  },

  getToken: function (successCallback, failCallback) {
    makeRequest({
      method: "GET",
      url: BASE_URL + TOKEN_SUFFIX,
      parameters: {},
      onSuccess: function (transport) {
        readerToken = transport.responseText;
        successCallback();

      },
      onFailure: function (transport) {
        console.error("failed", transport);
        if (failCallback) {
          failCallback(greader.normalizeError(transport.responseText));
        }
      }
    });
  },

  load: function (successCallback, failCallback) {
    makeRequest({
      method: "GET",
      url: BASE_URL + USERINFO_SUFFIX,
      parameters: {},
      onSuccess: function (transport) {
        var user = JSON.parse(transport.responseText)
        readerUser.set(user);
        successCallback(user);
      },
      onFailure: function (transport) {
        console.error(transport);
        if (failCallback) {
          failCallback(greader.normalizeError(transport.responseText));

        }
      }
    });
  },

  loadPreferences: function (successCallback, failCallback) {
    makeRequest({
      method: "GET",
      url: BASE_URL + PREFERENCES_PATH,
      parameters: {},
      onSuccess: function (transport) {
        User.preferencesLoaded = true;
        User.preferences = JSON.parse(transport.responseText).streamprefs;
        if (successCallback) {
          successCallback();
        }
      },
      onFailure: function (transport) {
        console.error(transport);
        if (failCallback) {
          failCallback(greader.normalizeError(transport.responseText));

        }
      }
    });
  },

  get: function () {
    return readerUser.get();
  }

};

greader.user = User;



var Feeds, Labels;


var editFeed = function (params, successCallback, failCallback) {
  if (!params) {
    console.error("No params for feed edit");
    return;
  }

  makeRequest({
    method: "POST",
    url: BASE_URL + SUBSCRIPTIONS_PATH + EDIT_SUFFIX,
    parameters: params,
    onSuccess: function (transport) {
      successCallback(transport.responseText);
    },
    onFailure: function (transport) {
      console.error(transport);
      if(failCallback)
        failCallback(transport);
    }
  });
};

Feeds = {

  set: function (feeds) {
    readerFeeds = feeds;
  },

  get: function () {
    return readerFeeds;
  },

  load: function (successCallback) {
    if (!greader.user.preferencesLoaded) {
      return greader.user.loadPreferences(_.bind(Feeds.load, this, successCallback));
    }

    async.parallel({
      subscriptions: function (cb) {
        makeRequest({
          method: "GET",
          url: BASE_URL + SUBSCRIPTIONS_PATH + LIST_SUFFIX,
          onSuccess: function (transport) {
            cb(null, JSON.parse(transport.responseText).subscriptions);
          },
          onFailure: function (transport) {
            cb("error loading feeds", transport);
          }
        });
      },
      labels: function (cb) {
        Labels.load(function (labels) {
          cb(null, labels)
        });
      },
      unreadcounts: function (cb) {
        Feeds.getUnreadCounts(function (unreadcounts) {
          cb(null, unreadcounts);
        });
      }
    }, function (err, results) {
      if (err) {
        console.error(err);
        return;
      }

      var feeds = Feeds.organize(
        results.subscriptions,
        results.labels,
        results.unreadcounts,
        greader.user.preferences
      );

      Feeds.set(feeds);
      successCallback(feeds);
    })


  },

  organize: function (feeds, inLabels, unreadCounts, userPrefs) {
    var unlabeled = [],
      labels = _(inLabels).reject(function(label){
        return greader.correctId(label.id) === "user/-/state/com.google/broadcast" || greader.correctId(label.id) === "user/-/state/com.blogger/blogger-following";
      });

    labels.unshift({title: "All", id: greader.TAGS["reading-list"], feeds: feeds, isAll: true, isSpecial: true});

    var labelTitleRegExp = /[^\/]+$/i;
    _(labels).each(function (label) {

      label.title = label.title || labelTitleRegExp.exec(label.id)[0];

      //based on title add unique properties
      if (label.title === "starred") {
        label.title = _(label.title).capitalize();
        label.isSpecial = true;
      } else if (!label.isSpecial) {
        label.isLabel = true;
      }

      label.feeds = [];

      //remove digits from the id
      label.id = greader.correctId(label.id);

      //apply unreadCounts
      _(unreadCounts).each(function (unreadCount) {
        unreadCount.id = greader.correctId(unreadCount.id);

        if (label.id === unreadCount.id) {
          label.count = unreadCount.count;
          label.newestItemTimestamp = unreadCount.newestItemTimestampUsec;
        }
      });
    });

    //process feeds
    _(feeds).each(function (feed) {
      //give isFeed property, useful for identifying
      feed.isFeed = true;

      //replace digits from the id
      feed.id = greader.correctId(feed.id);

      //apply unread counts
      _(unreadCounts).each(function (unreadCount) {
        if (feed.id === unreadCount.id) {
          feed.count = unreadCount.count;
          feed.newestItemTimestamp = unreadCount.newestItemTimestampUsec;
        }
      });

      if (feed.categories.length === 0) {
        //if the feed has no labels, push it onto the unlabeled array
        unlabeled.push(feed);
      } else {
        //otherwise find the label from the labels array and push the feed into its feeds array
        _(feed.categories).each(function (label) {
          label.id = greader.correctId(label.id);
          _(labels).each(function (fullLabel) {
            if (label.id === fullLabel.id) {
              var feed_clone = _(feed).clone();
                feed_clone.inside = fullLabel.id;

              fullLabel.feeds.push(feed_clone);
            }
          });
        });
      }

    });

    //replace digits
    _(userPrefs).each(function (value, key) {
      if (/user\/\d*\//.test(key)) {
        userPrefs[greader.correctId(key)] = value;
      }
    });

    //remove labels with no feeds
    var labelsWithFeeds = _(labels).reject(function (label) {
      return (label.feeds.length === 0 && !label.isSpecial);
    });

    //order the feeds within labels
    _(labelsWithFeeds).each(function (label) {
      //get the ordering id based on the userPrefs
      var orderingId = _(userPrefs[label.id]).detect(function (setting) {
        return (setting.id === "subscription-ordering");
      });
      if (orderingId) {
        label.feeds = _(label.feeds).sortBy(function (feed) {
          if (orderingId.value.indexOf(feed.sortid) === -1) {
            //if our sortid isn't there, the feed should be at the back.
            return 1000;
          }
          //return the index of our feed sortid, which will be in multiples of 8 since sortid's are 8 characters long.
          return (orderingId.value.indexOf(feed.sortid)) / 8;
        });
      } //there might be another setting we should follow like "alphabetical" or "most recent". Just a guess.
      /*else {
        labels.feeds.sort();
      }*/

    });

    //now order ALL feeds and labels
    var orderingId = _(userPrefs["user/-/state/com.google/root"]).detect(function (setting) {
      return (setting.id === "subscription-ordering");
    }) || {value: ""};


    //our subscriptions are our labelsWithFeeds + our unlabeled feeds
    var subscriptions = [].concat(labelsWithFeeds, unlabeled);
      //sort them by sortid
      subscriptions = _(subscriptions).sortBy(function (subscription) {
        if (orderingId.value.indexOf(subscription.sortid) === -1 && !subscription.isSpecial) {
          return 1000;
        }
        return (orderingId.value.indexOf(subscription.sortid)) / 8;
      });

    return subscriptions;
  },

  //edit feed title
  editFeedTitle: function (feedId, newTitle, successCallback, failCallback) {
    editFeed({
      ac: "edit",
      t: newTitle,
      s: feedId
    }, successCallback, failCallback);
  },

  editFeedLabel: function (feedId, label, opt, successCallback, failCallback) {
    //label needs to have greader.TAGS["label"] prepended.
    var obj = {
      ac: "edit",
      s: feedId
    };
    if (opt) {
      obj.a = label;
    } else {
      obj.r = label;
    }
    editFeed(obj, successCallback, failCallback);
  },

  getUnreadCounts: function (successCallback, returnObject) {
  //passing true for returnObject gets you an object useful for notifications
    makeRequest({
      url: BASE_URL + UNREAD_SUFFIX,
      onSuccess: function (transport) {
        var unreadCounts = JSON.parse(transport.responseText).unreadcounts;
        //console.log(transport);
        var unreadCountsObj = {};
        _(unreadCounts).each(function (obj) {
          unreadCountsObj[greader.correctId(obj.id)] = obj.count;
        });
        greader.unreadCountsObj = unreadCountsObj;

        if (returnObject) {
          successCallback(unreadCountsObj);
        } else {
          successCallback(unreadCounts);
        }

      },
      onFailure: function (transport) {
        console.error(transport);
      }
    });
  },

  unsubscribeFeed: function (feedId, successCallback) {
    editFeed({
      ac: "unsubscribe",
      s: feedId
    }, successCallback);
  },

  subscribeFeed: function (feedUrl, successCallback, title) {
    editFeed({
      ac: "subscribe",
      s: "feed/" + feedUrl,
      t: title || undefined
    }, successCallback);
  },

  markAllAsRead: function (subscriptionId, successCallback) {
    //feed or label
    makeRequest({
      method: "POST",
      url: BASE_URL + MARK_ALL_READ_SUFFIX,
      parameters: {
        s: subscriptionId
      },
      onSuccess: function (transport) {
        successCallback(transport.responseText);
      },
      onFailure: function (transport) {
        console.error(transport);
      }

    });
  }

}; // Feeds


Labels = {
  get: function () {
    return _(Feeds.get()).select(function (feed) { return feed.isLabel; });
  },

  load: function (successCallback) {
    makeRequest({
      method: "GET",
      url: BASE_URL + TAGS_PATH + LIST_SUFFIX,
      onSuccess: function (transport) {
        successCallback(JSON.parse(transport.responseText).tags);
      },
      onFailure: function (transport) {
        console.error(transport);
      }
    });
  },

  editLabelTitle: function (labelId, newTitle, successCallback, failCallback) {
    //label needs to have greader.TAGS["label"] prepended.
    makeRequest({
      method: "POST",
      url: BASE_URL + RENAME_LABEL_SUFFIX,
      parameters: {
        s: labelId,
        t: labelId,
        dest: greader.TAGS["label"] + newTitle
      },
      onSuccess: function (transport) {
        successCallback(transport.responseText);
      },
      onFailure: function (transport) {
        console.error(transport);
        if (failCallback)
          failCallback();
      }
    });
  }

}; // Labels


greader.feeds  = Feeds;
greader.labels = Labels;


/*

// This function searches Google's feed API to find RSS feeds.
var readerUrlRegex = /(http|ftp|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?\^=%&amp;:\/~\+#]*[\w\-\@?\^=%&amp;\/~\+#])?/;
greader.processFeedInput = function (input, successCallback, failCallback) {
  if (readerUrlRegex.test(input)) {
    makeRequest({
      url: "https://ajax.googleapis.com/ajax/services/feed/load",
      parameters: {
        q: encodeURI(input),
        v: "1.0"
      },
      onSuccess: function (transport) {
        var response = JSON.parse(transport.responseText);
        if (response.responseStatus === 200) {
          successCallback({isFeed: true, title: response.responseData.feed.title})
        } else {
          greader.searchForFeeds(input, successCallback, failCallback);
        }

      },
      onFailure: function (transport) {
        console.error(transport);
      }
    }, true);
  } else {
    greader.searchForFeeds(input, successCallback, failCallback);
  }
};

greader.searchForFeeds = function (input, successCallback, failCallback) {
  //remove http://
  //remove path
  //remove TLD
  input = input.replace(/(http:\/\/|https:\/\/)/ig, "").split("/")[0].replace(/\.\w{1,3}\.*\w{0,2}$/ig, "");

  makeRequest({
    url: "https://ajax.googleapis.com/ajax/services/feed/find",
    parameters: {
      q: encodeURI(input),
      v: "1.0"
    },
    onSuccess: function (transport) {
      var response = JSON.parse(transport.responseText);
      if (response.responseStatus === 200) {
        if (response.responseData.entries) {
          successCallback({results: response.responseData.entries}, "keyword");
        }
      } else {
        failCallback(response.responseDetails);
      }

    },
    onFailure: function (transport) {
      console.error(transport);
    }
  }, true);
};

*/


// *************************************
// *
// *  Loading Items
// *
// *************************************

greader.getItems = function (feedUrl, successCallback, opts) {
  var params = opts || {n: 50};
    params.r = params.r || "d";

  makeRequest({
    method: "GET",
    url: BASE_URL + STREAM_PATH + encodeURIComponent(feedUrl),
    parameters: params, /*{
      //ot=[unix timestamp] : The time from which you want to retrieve items. Only items that have been crawled by Google Reader after this time will be returned.
      //r=[d|n|o] : Sort order of item results. d or n gives items in descending date order, o in ascending order.
      //xt=[exclude target] : Used to exclude certain items from the feed. For example, using xt=user/-/state/com.google/read will exclude items that the current user has marked as read, or xt=feed/[feedurl] will exclude items from a particular feed (obviously not useful in this request, but xt appears in other listing requests).
    },*/
    onSuccess: function (transport) {
      successCallback(JSON.parse(transport.responseText).items);
    },
    onFailure: function (transport) {
      console.error(transport);
    }
  });
};

// *************************************
// *
// *  Editing Items
// *
// *************************************

greader.setItemTag = function (subscriptionId, itemId, tag, add, successCallback, failCallback) {

  //single sub id or array of sub ids (ex: ["subId1", "subId2", ...])
  //single item id or array of item ids in corresponding order of sub ids (ex: ["itemId1", "itemId2", ...])
  //tag in simple form: "like", "read", "share", "label", "star", "kept-unread"
  //add === true, or add === false

  //WARNING: The API seems to fail when you try and change the tags of more than ~100 items.

  var params = {
    async: "true",
    ac: "edit-tags"
  };

  if (add === true) {
    params.a = greader.TAGS[tag];
  } else  {
    params.r = greader.TAGS[tag];
  }

  if(_.isArray(itemId) && _.isArray(subscriptionId)){
    params.set = [];
    _.each(itemId, function(singleItemId, index){
      params.set.push({i: singleItemId, s: subscriptionId[index]});
    });
  } else {
    params.s = subscriptionId;
    params.i = itemId;
  }


  makeRequest({
    method: "POST",
    url: BASE_URL + EDIT_TAG_SUFFIX,
    parameters: params,
    onSuccess: function (transport) {
      if (transport.responseText === "OK") {
        successCallback(transport.responseText);
      }
    },
    onFailure: function (transport) {
      console.error("FAILED", transport);
      if(failCallback)
        failCallback();
    }
  });
};

//this function replaces the number id with a dash. Helpful for comparison
var readerIdRegExp = /user\/\d*\//;
greader.correctId = function (id) {
  return id.replace(readerIdRegExp, "user\/-\/");
};

var trueRegExp = /^true$/i;
greader.isRead = function (article) {
  if(article.read !== undefined){
    return trueRegExp.test(article.read);
  }
  for (var i = 0; i < article.categories.length; i++) {
    if(greader.correctId(article.categories[i]) === greader.TAGS['read']){
      return true;
    }
  };

  return false;
};

greader.isStarred = function (article) {
  if(article.starred !== undefined){
    return trueRegExp.test(article.starred);
  }
  for (var i = 0; i < article.categories.length; i++) {
    if(greader.correctId(article.categories[i]) === greader.TAGS['star']){
      return true;
    }
  };

  return false;
};

//returns url for image to use in the icon
greader.getIconForFeed = function (feedUrl) {
  return "http://www.google.com/s2/favicons?domain_url=" + encodeURIComponent(feedUrl);
};

//normalizes error response for logging in
greader.normalizeError = function (inErrorResponse) {
  var errorMessage = _(inErrorResponse).lines()[0].replace("Error=", "").replace(/(\w)([A-Z])/g, "$1 $2");
  errorMessage = (errorMessage === "Bad Authentication") ? "Incorrect Email/Password" : errorMessage;
  return errorMessage;
};
}).call(this);