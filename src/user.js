
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

