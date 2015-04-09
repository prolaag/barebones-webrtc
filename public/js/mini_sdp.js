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
//var channel = prompt('Please choose a room name', 'default')
var channel = 'default';
function send(data) {post_ajax("/send/" + channel, {msg: data} );}
function messages() {
  getJSON("/read/" + channel, function(offer) {
    switch(offer.type) {
      case 'offer':
        document.querySelector('button#startButton').disabled = true;
        offer_type = 'answer';
        offer.sdp = create_sdp(offer.sdp);
        pc.setRemoteDescription(new RTCSessionDescription(offer), function() {
          pc.createAnswer(function(answer) {
            pc.setLocalDescription(new RTCSessionDescription(answer), function() {}, error);
          }, error);
        }, error);
        send_channel = pc.createDataChannel('sendDataChannel', {reliable: true});
        break;
      case 'answer':
        offer.sdp = create_sdp(offer.sdp);
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
var send_channel;

// return an object containing just the relevant parts of the sdp
function sdp_info(sdp) {
  var sdp_info = {};

  // Notes per https://tools.ietf.org/html/rfc5245
  // ice-ufrag and ice-pwd contain up to 256 'ice-char's [a-zA-z0-9/\+]
  // ice-ufrag will contain at least 4 'ice-char's
  // ice-pwd will contain at least 22 'ice-char's
  // each 'ice-char' contains 6 bits of data, so 192 bytes worst-case
  // would be needed to store those fields, plus an additional 5 bits for
  // the length of the ice-ufrag field (though possible ranges are limited
  // to 29 values: [4-32], and 4 bits to store the ice-pwd field length
  // (since possible ranges are limited to 11 values: [22-32]
  sdp_info.ice_ufrag =    sdp.match(/^a=ice-ufrag:(.*)$/m)[1];
  sdp_info.ice_pwd =      sdp.match(/^a=ice-pwd:(.*)$/m)[1];
  // the fingerprint contains ASCII hex bytes separated by ':'
  // for sha-256 string is 32 bytes, thus (32 * 3 - 1) = 95 chars long
  // Notes per https://tools.ietf.org/html/rfc4572
  // "sha-256" is hard-coded here, but could theoretically be any of:
  // sha-1 sha-224 sha-256 sha-384 sha-512 md5 md2
  // Research indicates that we might be able to limit this to
  // sha-256 sha-384 and sha-512
  sdp_info.fingerprint =  sdp.match(/^a=fingerprint:sha-256 (.*)$/m)[1];
  // setup is one of either 'actpass' or 'active' and thus just 1 bit
  sdp_info.setup =        sdp.match(/^a=setup:(.*)$/m)[1];
  // each candidate contains the following information:
  // foundation (1-32 'ice-char's) - receiver may not care if hard-coded
  // component-id (1-5 digits) - receiver probably doesn't care
  // transport ('udp' or 'tcp') - 1 bit needed
  // priority (could probably be hard-coded, maybe unique)
  // ip address (4 bytes assuming ipv4)
  // port (2 bytes)
  // candidate type (the text 'typ ' + one of [host srflx prflx relay]
  // the text 'tcptyp active' when 'tcp' is the transport
  // the text 'generation 0'
  sdp_info.candidates =   sdp.match(/^a=candidate:(.*)$/gm);

  return sdp_info;
}

function create_sdp(sdp_info) {
  log('Creating SDP from: ' + JSON.stringify(sdp_info));
  var candidates = '';
  sdp_info.candidates.forEach(function(element) { candidates += '\r\na=candidate:' + element; } );
  candidates = candidates.replace(/^\r\n/, '');
  var sdp = [
    "v=0",
    "o=- 123456789012345678 2 IN IP4 127.0.0.1",
    "s=-",
    "t=0 0",
    "a=msid-semantic: WMS",
    "m=application 12345 DTLS/SCTP 5000",
    "c=IN IP4 0.0.0.0",
    candidates,
    "a=ice-ufrag:" + sdp_info.ice_ufrag,
    "a=ice-pwd:" + sdp_info.ice_pwd,
    "a=fingerprint:sha-256 " + sdp_info.fingerprint,
    "a=setup:" + sdp_info.setup,
    "a=mid:data",
    "a=sctpmap:5000 webrtc-datachannel 1024\r\n",
  ];

  sdp = sdp.join("\r\n");

  log('Created sdp: ' + sdp);

  return sdp;
}

// if our peer sets up a data channel, set our receive channel to that channel
pc.ondatachannel = function(data_channel_event) {
  // this function is invoked whenever a message from our peer arrives
  data_channel_event.channel.onmessage = function(data_channel_event) {
    document.querySelector('textarea#dataChannelReceive').value = data_channel_event.data;
  }
  document.querySelector('button#sendButton').disabled = false;
  // logged to the console to let us know when this happens
  log('Created a receive data channel - may now receive data from peer.');
  clearInterval(interval);
}

// add a callback for when ice candidates are created by the peer connection
pc.onicecandidate = function(ice_event) {
  log('Received new ice candidate');
  if (!ice_event.candidate) {
    var sdp_fields = sdp_info(pc.localDescription.sdp);
    log('Reduced description sent to peer: ' + JSON.stringify(sdp_fields));
    send({type: offer_type, sdp: sdp_fields});
  }
};

// call this to kick off the session negotiation process with a remote peer
document.querySelector('button#startButton').onclick = function() {
  document.querySelector('button#startButton').disabled = true;
  send_channel = pc.createDataChannel('sendDataChannel', {reliable: true});
  pc.createOffer(function(offer) {
    pc.setLocalDescription(new RTCSessionDescription(offer), function() {}, error);
  }, error);
};
// call this to send the textbox content through our send channel
document.querySelector('button#sendButton').onclick = function() {
  send_channel.send(document.querySelector('textarea#dataChannelSend').value)
};
