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
var channel = prompt('Please choose a room name', 'default')
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
var send_channel;

// if our peer sets up a data channel, set our receive channel to that channel
pc.ondatachannel = function(data_channel_event) {
  // this function is invoked whenever a message from our peer arrives
  data_channel_event.channel.onmessage = function(data_channel_event) {
    document.querySelector('textarea#dataChannelReceive').value = data_channel_event.data;
  }
  // logged to the console to let us know when this happens
  log('Created a receive data channel - may now receive data from peer.');
}

// add a callback for when ice candidates are created by the peer connection
pc.onicecandidate = function(ice_event) {
  log('Received new ice candidate');
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
// call this to send the textbox content through our send channel
document.querySelector('button#sendButton').onclick = function() {
  send_channel.send(document.querySelector('textarea#dataChannelSend').value)
};
