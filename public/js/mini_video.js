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

        getUserMedia({video: true, audio: true}, function(stream) {
          local_stream = stream;
          log("Received local stream");
          // show our own video locally
          document.getElementById("localVideo").src = URL.createObjectURL(local_stream);

          pc.addStream(local_stream);

          pc.setRemoteDescription(new RTCSessionDescription(offer), function() {
            pc.createAnswer(function(answer) {
              pc.setLocalDescription(new RTCSessionDescription(answer), function() {}, error);
            }, error);
          }, error);
        }, error);
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
// pc will always be in the global scope
// Note: RTCPeerConnection is abstracted in adapter.js for cross-browser support
var pc = window.pc = new RTCPeerConnection(null, null);
var local_stream;

pc.onaddstream = function(add_stream_event) {
  log('Received a video stream from remote peer');
  document.getElementById("remoteVideo").src = URL.createObjectURL(add_stream_event.stream);
  // stop polling for signal messages
  clearInterval(interval);
}

pc.onicecandidate = function(ice_event) {
  if (!ice_event.candidate) {
    log('Description sent to peer: ' + JSON.stringify(pc.localDescription));
    send({type: offer_type, sdp: pc.localDescription.sdp});
  }
};

// call this to kick off the session negotiation process with a remote peer
document.getElementById("startButton").onclick = function() {
  log("Requesting local stream");
  getUserMedia({video: true, audio: true}, function(stream) {
      local_stream = stream;
      log("Received local stream");

      // per Mozilla API docs, this should not trigger the onaddstream callback
      pc.addStream(local_stream);
      // start creating the offer for our peer
      pc.createOffer(function(offer) {
        pc.setLocalDescription(new RTCSessionDescription(offer), function() {}, error);
      }, error);
      // show our own video locally
      document.getElementById("localVideo").src = URL.createObjectURL(local_stream);
    },
    error);
};
document.getElementById("hangupButton").onclick = function() {
  log("Ending call");
  pc.close();
  pc = window.pc = new RTCPeerConnection(null, null);
  interval = setInterval(messages, 5000);
};
