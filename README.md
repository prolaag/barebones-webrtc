# Tiny WebRTC Examples - without node.js or WebSockets
This project contains WebRTC examples that use Sinatra and AJAX for signaling.
It was created to demonstrate minimalistic data channel and media stream setup,
and to demonstrate minimalistic signal exchange between two clients.

This project was inspired in part by: https://github.com/cjb/serverless-webrtc/

These examples do not use public STUN servers, so they may not work when peers
are behind a network that uses NAT.

# Dependencies

Sinatra (`gem install sinatra`)

# Usage

```
ruby webrtc.rb
```

# How it Works

Each example prompts for a channel name so multiple examples may be run
concurrently. Each active client then polls that signaling channel via HTTP GET
requests for incoming messages.

When a client begins the channel setup (by clicking 'Begin channel setup'), the
client collects information about their own setup and network configuration,
then POSTs that information to the Sinatra server in SDP (Session Description
Protocol) format.

When another peer on the same channel (and from a different IP address) polls
the channel again, that peer will receive the original client's SDP and
generate their own SDP in response. After the response is generated, the
response is POSTed to the same channel for the original client.

Once the initiator has received the peer response, the WebRTC channel will be
established and the functionality can be demoed.

Please use the console in Chrome and Firefox to view debugging information.

# Security Notes

This example project was build to demonstrate bare-bones signal handling.
The SDP exchange is done in plain text, and the peer-to-peer data exchange is
unencrypted.
