# Serverless n-party calls over WebRTC (SnoW)

This is the open-source companion code for the
[SnoW paper](https://arxiv.org/abs/2206.12762). It contains both a reference implementation
of the multi-party communication models presented, as
well as experiment code to reproduce the results
in different setups.

The implemented models include:

* [MESH](public/js/snowmesh.js): A 3-party mesh network where all parties connect to each other
          with a standard WebRTC  PeerConnection.
* [SFU](public/js/snowsfu.js): A 3-party call model where one party receives a PeerConnection
         with two streams that may be rendered locally.
* [MCU](public/js/snowmcu.js): A 3-party call model where one party receives a PeerConnection
         with a single merged stream. 
* [MCUTwo](public/js/snowmcutwo.js): A 3-party call model where both non-coordinator parties receive
         merged streams of the coordinator and the other party.
* [MCUMulti](public/js/snowmcumulti.js): An n-party call model where all non-coordinator parties receive
         the same merged stream from the coordinator containing all streams.


The stream mnerging is done with the [t-mullen JavaScript HTML5 video and audio merging library](https://github.com/t-mullen/video-stream-merger).

## Getting Started
The WebSocket server is a simple NodeJS express and socket.io server adapted from the [borjanebbal tutorial](https://github.com/borjanebbal/webrtc-node-app).

Install [Node and NPM](https://nodejs.org/en/) (tested with Node v17.2.0 and NPM v8.1.4), then run
```
npm install
```

To run the server run
```
node server.js
```
A Web server containing a web socket endpoint will then start on [http://localhost:3000](http://localhost:3000).

The URL can be visited with a `room` URL parameter to run multiple sessions against the same server concurrently.
The default room is demo. E.g. visiting  [http://localhost:3000](http://localhost:3000) is equivalent to visiting
 [http://localhost:3000?room=demo](http://localhost:3000?room=demo).

On the landing page there is a drop down where the model can be selected. All parties in the call need to select the
same model, oitherwise the behavior is not defined.

The system may be tested from 3 local browsers but there will not be any interesting performance data in that case.

To run the example across devices the Web server needs to be served behind a https endpoint (a HTML5 web camera access
restriction). The easiest way to accomplish that is to run [ngrok](https://ngrok.com/).
```
ngrok http 3000
```

It will display a https endpoint on the screen that may be shared with all participants.

## Experiment Setup
The first device that connects to a room (selects a model and clicks start) will
become the initiator and coordinator. It is recommended that this is the most powerful (CPU and network) device as it
will do the most heavy-lifting in the calls.

After about one minute of the call being established [WebRTC Stats API statistics](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_Statistics_API) 
will be collected until the call is ended. Calls may be ended by all parties but for collecting experiment data it
is recommended to have the initiator also initiate the termination of calls by pressing the hangup button. The statistics is check-pointed for each call
and is stored in localStorage as JSON that may be exported with the Export Stats link. Note that only statistics for the local peer
is collected and exported, so all peers need to export their data to fully analyze a call.

See the [stats class](public/js/stats.js) for details on what statistics are collected.
