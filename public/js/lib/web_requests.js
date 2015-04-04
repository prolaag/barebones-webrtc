// replacement for JQuery's $.getJSON(url, callback)
function getJSON(path, callback) {
  var request = new XMLHttpRequest();
  request.open('GET', path, true);

  request.onload = function() {
    if (request.status >= 200 && request.status < 400) {
      callback(JSON.parse(request.responseText));
    }
  }

  request.send();
}

// replacement for JQuery's $.post(url, data) when data is JSON
function post_ajax(url, data) {
  var request = new XMLHttpRequest();
  request.open('POST', url, true);
  request.setRequestHeader('Content-Type', 'application/json; charset=UTF-8');
  request.send(JSON.stringify(data));
}
