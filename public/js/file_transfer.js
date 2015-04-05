//
// helper functions, just for logging
//

function log(text) { console.log(text.replace(/^\s+|\s+$/g, '')); }
function error(err) { log('Encountered an error: ' + err.name); pc.close(); }

//
// overhead for signaling
//

// change to 'answer' if not the initiator
var offer_type = 'offer';
var channel = prompt('Please choose a room name', 'filetx')
function send(data) {post_ajax("/send/" + channel, {msg: data} );}
function messages() {
  getJSON("/read/" + channel, function(offer) {
    switch(offer.type) {
      case 'offer':
        offer_type = 'answer';
        pc.setRemoteDescription(new RTCSessionDescription(offer), function() {
          pc.createAnswer(function(answer) {
            pc.setLocalDescription(new RTCSessionDescription(answer), function() {}, error);
          }, error);
        }, error);
        log('Received an offer: ' + offer.sdp);
        send_channel = pc.createDataChannel('sendDataChannel', {reliable: true});
        break;
      case 'answer':
        pc.setRemoteDescription(new RTCSessionDescription(offer), function() {}, error);
        break;
      default: break;
    }
  });
}
var interval = setInterval(messages, 5000);

//
// meat of webRTC functionality
//

// main peer connection object - need one per peer
// pc will always been in the global scope
// Note: RTCPeerConnection is abstracted in adapter.js for cross-browser support
var pc = window.pc = new RTCPeerConnection(null, null);
var send_channel, outgoing_file, incoming_file = {};
var start_token = 0, data_token = 1, end_token = 2;

// if our peer sets up a data channel, set our receive channel to that channel
pc.ondatachannel = function(data_channel_event) {
  // this function is invoked whenever a message from our peer arrives
  data_channel_event.channel.onmessage = function(data_channel_event) {
    var raw_data = data_channel_event.data.slice(2);
    var type = (new Uint16Array(data_channel_event.data.slice(0, 2)))[0];
    switch(type) {
      case start_token:
        var result = "";
        raw_data = new Uint16Array(raw_data);
        // this message contains metadata about an incoming file transfer
        // jump through Javascript hoops to turn it into JSON
        for(var i = 0; i < raw_data.length; i++) { result += String.fromCharCode(raw_data[i]); }
        var data = JSON.parse(result);
        incoming_file = data;
        incoming_file.received_size = 0;
        incoming_file.content = [];
        log('New incoming file: ' + JSON.stringify(incoming_file));
        break;
      case data_token:
        incoming_file.content.push(raw_data);
        incoming_file.received_size += raw_data.byteLength;

        // if we've received everything from our peer
        if(incoming_file.received_size == incoming_file.size) {
          log('Incoming file finished');
          // add a link to the file
          var received = new window.Blob(incoming_file.content);
          var link = document.createElement('a');
          link.href = URL.createObjectURL(received);
          link.download = incoming_file.name;
          link.target = '_blank';
          link.appendChild(document.createTextNode(
            'Download ' + incoming_file.name + ' [' + incoming_file.size +' bytes]')
          );
          document.querySelector('div#receivedFiles').appendChild(link);
          document.querySelector('div#receivedFiles').appendChild(document.createElement('br'));
        }
        break;
      default:
        break;
    }
  }
  // logged to the console to let us know when this happens
  log('Created a receive data channel - may now receive data from peer.');
  clearInterval(interval);
}

// add a callback for when ice candidates are created by the peer connection
pc.onicecandidate = function(ice_event) {
  if (!ice_event.candidate) {
    log('Description sent to peer: ' + JSON.stringify(pc.localDescription));
    send({type: offer_type, sdp: pc.localDescription.sdp});
  }
};

// call this to kick off the session negotiation process with a remote peer
document.querySelector('button#startButton').onclick = function() {
  send_channel = pc.createDataChannel('sendDataChannel', {reliable: true});
  pc.createOffer(function(offer) {
    pc.setLocalDescription(new RTCSessionDescription(offer), function() {}, error);
  }, error);
};

var chunk_length = 1024;
// called whenever a file is selected through the front-end
document.querySelector('input[type=file]').onchange = function() {
  outgoing_file = this.files[0];

  // this function transfers a little bit of the file at a time
  var slice_file = function(offset) {
    var reader = new window.FileReader();
    reader.onload = (function() {
      return function(e) {
        var data = new Uint8Array(e.target.result.byteLength + 2);
        // set the first byte to the data token
        data.set([data_token], 0);
        // read the file into an array
        data.set(new Uint8Array(e.target.result), 2);
        send_channel.send(data.buffer);
        // if there is more file to send, send it
        if (outgoing_file.size > offset + e.target.result.byteLength) {
          window.setTimeout(slice_file, 1, offset + chunk_length);
        }
      };
    })(outgoing_file);
    var slice = outgoing_file.slice(offset, offset + chunk_length);
    reader.readAsArrayBuffer(slice);
  };
  // tell the other end what they're about to get
  var file_desc = JSON.stringify({
    name: outgoing_file.name, type: outgoing_file.type, size: outgoing_file.size
  });
  // jump through JavaScript's hoops to get that string (16-bit chars) into the
  // destination buffer
  var data = new Uint16Array(1 + file_desc.length);
  for(var i = 1; i <= file_desc.length; i++) { data.set([file_desc.charCodeAt(i - 1)], i) }
  data.set([start_token], 0);
  // send the description of the incoming file to the recipient
  send_channel.send(data.buffer);
  // start the file transfer
  slice_file(0);
};
