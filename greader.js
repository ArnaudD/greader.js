
(function() {

  var readerToken = "",
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
      EDIT_TAG_SUFFIX       = "edit-tag";

  /**
   * Eng setup
   */

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

  _.mixin(_.string.exports());
  _.string.include('Underscore.string', 'string'); // => true


  /**
   * Persistance
   */
  
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

  var readerFeeds = [], //we want to be able to get/set our feeds outside of this file
      readerAuth = new localStorageWrapper("Auth"), //no interface outside of this file
      readerUser = new localStorageWrapper("User"); //can get from outside of file

  greader.setFeeds = function (feeds) {
    readerFeeds = feeds;
  };
  greader.getFeeds = function () {
    return readerFeeds;
  };
  greader.getLabels = function () {
    return _(greader.getFeeds()).select(function (feed) { return feed.isLabel; });
  };
  greader.getUser = function () {
    return readerUser.get();
  };


  /**
   * Networking
   */

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
          greader.getToken(function () {
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


  /**
   * Authentication
   */
  
  greader.hasAuth = function(){
    if(readerAuth.get()){
      return true;
    }
  };

  //Get our auth header; saved to localStorage.
  greader.login = function (email, password, successCallback, failCallback) {
    console.log('login ' + email);
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
        getUserInfo(successCallback, failCallback);
      },
      onFailure: function (transport) {
        console.error(transport);
        failCallback(greader.normalizeError(transport.responseText));
      }
    });
  };

  //Gets our token for POST requests; saved to localStorage;.
  //If it fails, your auth header has expired and you need to have the user login again.
  greader.getToken = function (successCallback, failCallback) {
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
  };

  greader.logout = function () {
    readerAuth.del();
    readerUser.del();
    greader.setFeeds([]);
  };

  var getUserInfo = function (successCallback, failCallback) {
    makeRequest({
      method: "GET",
      url: BASE_URL + USERINFO_SUFFIX,
      parameters: {},
      onSuccess: function (transport) {
        readerUser.set(JSON.parse(transport.responseText));
        successCallback();
      },
      onFailure: function (transport) {
        console.error(transport);
        if (failCallback) {
          failCallback(greader.normalizeError(transport.responseText));

        }
      }
    });
  };

  var getUserPreferences = function (successCallback, failCallback) {
    makeRequest({
      method: "GET",
      url: BASE_URL + PREFERENCES_PATH,
      parameters: {},
      onSuccess: function (transport) {
        greader.has_loaded_prefs = true;
        greader.userPrefs = JSON.parse(transport.responseText).streamprefs;
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
  };

  /**
   * Feeds
   */
  
  //Get the user's subscribed feeds, organizes them in a nice little array.
  greader.loadFeeds = function (successCallback) {
    function loadFeeds() {
      makeRequest({
        method: "GET",
        url: BASE_URL + SUBSCRIPTIONS_PATH + LIST_SUFFIX,
        onSuccess: function (transport) {
          //save feeds in an organized state.

          loadLabels(function (labels) {
            //get unread counts
            getUnreadCounts(function (unreadcounts) {

              //organize and save feeds
              greader.setFeeds(
                organizeFeeds(
                  JSON.parse(transport.responseText).subscriptions,
                  labels,
                  unreadcounts,
                  greader.userPrefs
                )
              );

              //callback with our feeds
              successCallback(greader.getFeeds());
            });

          });

        },
        onFailure: function (transport) {
          console.error(transport);
        }
      });
    }
    if (greader.has_loaded_prefs) {
      loadFeeds();
    } else {
      getUserPreferences(loadFeeds);
    }
  };

  var loadLabels = function (successCallback) {
    makeRequest({
      method: "GET",
      url: BASE_URL + TAGS_PATH + LIST_SUFFIX,
      onSuccess: function (transport) {
        //save feeds in an organized state.
        successCallback(JSON.parse(transport.responseText).tags);
      },
      onFailure: function (transport) {
        console.error(transport);
      }
    });

  };

  //organizes feeds based on labels.
  var organizeFeeds = function (feeds, inLabels, unreadCounts, userPrefs) {
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
  };

  //get unread counts from google reader
  var getUnreadCounts = function (successCallback, returnObject) {
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
  };

  /**
   * Tools
   */

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