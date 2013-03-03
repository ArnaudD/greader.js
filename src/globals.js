
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
