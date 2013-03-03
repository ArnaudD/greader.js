
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