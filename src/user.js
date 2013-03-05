
greader.user = (function () {

  var userStore  = greader.stores.user,
      feedsStore = greader.stores.feeds,
      auth       = null,
      User;

  User = {

    isAuth: function () {
      return auth !== null;
    },

    getAuth: function () {
      return auth;
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
          auth = _.lines(transport.responseText)[2].replace("Auth=", "");
          userStore.put({name: 'auth', value: auth}, function () {
            User.load(successCallback, failCallback);
          });
        },
        onFailure: function (transport) {
          console.error(transport);
          failCallback(greader.normalizeError(transport.responseText));
        }
      });
    },

    logout: function () {
      userStore.clear();
      feedsStore.clear();
    },

    getToken: function (successCallback, failCallback) {
      makeRequest({
        method: "GET",
        url: BASE_URL + TOKEN_SUFFIX,
        parameters: {},
        onSuccess: function (transport) {
          console.log(transport);
          userToken = transport.responseText;
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
          userStore.put({name: 'info', value: user}, function () {
            successCallback(user);
          });
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
          userStore.put({name: 'preferences', value: this.preferences});
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

    get: function (successCallback, errorCallback) {
      userStore.get('info', successCallback, errorCallback);
    }
  };

  return User;

})();
