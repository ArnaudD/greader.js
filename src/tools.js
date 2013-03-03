
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