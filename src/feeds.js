
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
