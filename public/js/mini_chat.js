//
// helper functions, just for logging
//

function log(text) { console.log(text.replace(/^\s+|\s+$/g, '')); }
function error(err) { log('Encountered an error: ' + err.name); pc.close(); }

//
// overhead for signaling
//

// change to 'answer' if not the initiator
var offerType = 'offer';
var channel = prompt('Please choose a room name', 'default')
function send(data) {post_ajax("/send/" + channel, {msg: data} );}
function messages() {
  getJSON("/read/" + channel, function(offer) {
    switch(offer.type) {
      case 'offer':
        document.querySelector('button#startButton').disabled = true;
        offerType = 'answer';
        pc.setRemoteDescription(new RTCSessionDescription(offer), function() {
          pc.createAnswer(function(answer) {
            pc.setLocalDescription(new RTCSessionDescription(answer), function() {}, error);
          }, error);
        }, error);
        log('Received an offer: ' + offer.sdp);
        break;
      case 'answer':
        pc.setRemoteDescription(new RTCSessionDescription(offer), function() {}, error);
        break;
      default: break;
    }
  });
}
var interval = setInterval(messages, 1000);

//
// meat of webRTC functionality
//

// main peer connection object - need one per peer
// pc will always been in the global scope
// Note: RTCPeerConnection is abstracted in adapter.js for cross-browser support
var pc = window.pc = new RTCPeerConnection(null, null);
var sendChannel;

function rxMessage(ev) {document.querySelector('textarea#dataChannelReceive').value = ev.data;}

function enableSend(evt) {
  sendChannel = (evt.channel || evt.target);
  document.querySelector('button#sendButton').disabled = false;
  // logged to the console to let us know when this happens
  log('Created a receive data channel - may now receive data from peer.');
  sendChannel.onmessage = rxMessage;
  // stop polling for signaling messages
  clearInterval(interval);
}

// if our peer sets up a data channel, set our receive channel to that channel
pc.ondatachannel = enableSend;

// add a callback for when ice candidates are created by the peer connection
pc.onicecandidate = function(iceEvent) {
  log('Received new ice candidate');
  if (!iceEvent.candidate) {
    log('Description sent to peer: ' + JSON.stringify(pc.localDescription));
    send({type: offerType, sdp: pc.localDescription.sdp});
  }
};

// call this to kick off the session negotiation process with a remote peer
document.querySelector('button#startButton').onclick = function() {
  document.querySelector('button#startButton').disabled = true;
  sendChannel = pc.createDataChannel('sendDataChannel', {reliable: true});
  sendChannel.onopen = enableSend;
  pc.createOffer(function(offer) {
    pc.setLocalDescription(new RTCSessionDescription(offer), function() {}, error);
  }, error);
};
// call this to send the textbox content through our send channel
document.querySelector('button#sendButton').onclick = function() {
  sendChannel.send(document.querySelector('textarea#dataChannelSend').value)
};
