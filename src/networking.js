
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
