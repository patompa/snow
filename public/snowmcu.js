
class SnowMCU {
  constructor(options) {
    this.localStream = null;
    this.remoteStream1 = null;
    this.remoteStream2 = null;
    this.remoteStream3 = null;
    this.rtcPeerConnection1 = null; // OFFER->ANSWER: 0->1, 1<-0, 2<-0
    this.rtcPeerConnection2 = null; // OFFER->ANSWER: 0->2, 1->2, 2<-1
    this.rtcPeerConnection3 = null; // OFFER->ANSWER: 0->2, 1->2, 2<-1
    this.startedRelay = false;
    this.startedRelay2 = false;
    this.roomId = null;
    this.clientId = -1;
    this.streamAdded = null;
  }
  setLocalVideo(localVideo) {
    this.localVideo = document.getElementById(localVideo)
    return this;
  }
  setRemoteVideos(remoteVideos) {
    this.remoteVideo1 = document.getElementById(remoteVideos[0]);
    this.remoteVideo2 = document.getElementById(remoteVideos[1]);
    return this;
 }
  setWebSocket(socket) {
    this.socket = socket;
    this.initEvents();
    return this;
  }
  setMediaConstraints(mediaConstraints) {
    this.mediaConstraints = mediaConstraints;
    return this;
  }
  setIceServers(iceServers) {
    this.iceServers = iceServers;
    return this;
  }

  initEvents() {
    this.socket.on('room_created', this.onRoomCreated.bind(this));
    this.socket.on('room_joined',this.onRoomJoined.bind(this));
    this.socket.on('full_room', this.onFullRoom.bind(this));
    this.socket.on('start_call', this.onStartCall.bind(this));
    this.socket.on('webrtc_offer', this.onWebRTCOffer.bind(this));
    this.socket.on('webrtc_answer', this.onWebRTCAnswer.bind(this));
    this.socket.on('webrtc_ice_candidate', this.onWebRTCICECandidate.bind(this));
    this.socket.on('hangup', this.onHangUp.bind(this));
  }

  async onRoomCreated() {
    console.log('Socket event callback: room_created')
    await this.setLocalStream()
    this.clientId = 0;
  }
  async onRoomJoined(event) {
    console.log('Socket event callback: room_joined by ' + event.clientId)
    this.clientId = event.clientId
    this.roomId = event.roomId
    await this.setLocalStream()
    if (this.clientId == 2) {
      this.socket.emit('start_call', {roomId: this.roomId, to: 0, from: 2})
      //this.socket.emit('start_call', {roomId: this.roomId, to: 1, from: 2})
    }
  }
  async onFullRoom() {
    console.log("Room full");
    throw Error("Room full");
  }
  async onStartCall(event) {
    let to = event.to
    let from = event.from
    if (this.clientId != to) {
      return
    }
    console.log('Socket event callback: start_call to ' + to + ' from ' + from)

    if (!this.rtcPeerConnection1) {
      this.rtcPeerConnection1 = new RTCPeerConnection(this.iceServers)
      this.addLocalTracks(this.rtcPeerConnection1)
      this.rtcPeerConnection1.ontrack = this.setRemoteStream1.bind(this)
      this.rtcPeerConnection1.onicecandidate = this.sendIceCandidate1.bind(this)
      await this.createOffer(this.rtcPeerConnection1, 1)
    } else if (!this.rtcPeerConnection2) {
      this.rtcPeerConnection2 = new RTCPeerConnection(this.iceServers)
      // start merge
      // this.addLocalTracks(this.rtcPeerConnection2)
      // this.addRelayTracks(this.rtcPeerConnection2,this.remoteStream1)
      var merger = new StreamMerger(100,100,true,4/3);
      console.log(this.localStream);
      console.log(this.remoteStream1);
      merger.addStream(this.localStream, {streamId: this.localStream.id});
      merger.addStream(this.remoteStream1, {streamId: this.remoteStream1.id});
      merger.start();
      this.addRelayTracks(this.rtcPeerConnection2,merger.getResult());

      // end merge
      this.rtcPeerConnection2.ontrack = this.setRemoteStream2.bind(this)
      this.rtcPeerConnection2.onicecandidate = this.sendIceCandidate2.bind(this)
      await this.createOffer(this.rtcPeerConnection2, 2)
    } else {
      console.log("Setting up third relay call");
      this.rtcPeerConnection3 = new RTCPeerConnection(this.iceServers)
      console.log(this);
      this.addRelayTracks(this.rtcPeerConnection3, this.remoteStream2)
      this.rtcPeerConnection3.ontrack = this.setRemoteStream3.bind(this)
      this.rtcPeerConnection3.onicecandidate = this.sendIceCandidate3.bind(this)
      await this.createOffer(this.rtcPeerConnection3, 1)
    }
  }

  async onWebRTCOffer(event) {
    if (event.to !=this.clientId) {
      return;
    }
    console.log('Socket event callback: webrtc_offer to ' + event.to + " from " + event.from)

    if (event.to == 1) {
      if (!this.rtcPeerConnection1) {
        this.rtcPeerConnection1 = new RTCPeerConnection(this.iceServers)
        this.addLocalTracks(this.rtcPeerConnection1)
        this.rtcPeerConnection1.ontrack = this.setRemoteStream1.bind(this)
        this.rtcPeerConnection1.onicecandidate = this.sendIceCandidate1.bind(this)
        this.rtcPeerConnection1.setRemoteDescription(new RTCSessionDescription(event.sdp))
        await this.createAnswer(this.rtcPeerConnection1,0)
      } else {
        this.rtcPeerConnection2 = new RTCPeerConnection(this.iceServers)
        this.rtcPeerConnection2.ontrack = this.setRemoteStream2.bind(this)
        this.rtcPeerConnection2.onicecandidate = this.sendIceCandidate2.bind(this)
        this.rtcPeerConnection2.setRemoteDescription(new RTCSessionDescription(event.sdp))
        await this.createAnswer(this.rtcPeerConnection2, 0)
      }
      return;
    }
    // to 2 single multi track stream
    this.rtcPeerConnection1 = new RTCPeerConnection(this.iceServers)
    this.addLocalTracks(this.rtcPeerConnection1)
    this.rtcPeerConnection1.ontrack = this.setRemoteStream1.bind(this)
    this.rtcPeerConnection1.onicecandidate = this.sendIceCandidate1.bind(this)
    this.rtcPeerConnection1.setRemoteDescription(new RTCSessionDescription(event.sdp))
    await this.createAnswer(this.rtcPeerConnection1,0)
  };

  async onWebRTCAnswer(event) {
    if (event.to != this.clientId) {
      return;
    }
    console.log('Socket event callback: webrtc_answer to ' + event.to + ' from ' + event.from)
    if (event.from == 1) {
      if (this.rtcPeerConnection2 == null) {
        this.rtcPeerConnection1.setRemoteDescription(new RTCSessionDescription(event.sdp))
      } else {
        this.rtcPeerConnection3.setRemoteDescription(new RTCSessionDescription(event.sdp))
      }
      return;
    } 
    // from 2
    this.rtcPeerConnection2.setRemoteDescription(new RTCSessionDescription(event.sdp))
  };

  async onWebRTCICECandidate(event) {
    if (event.to != this.clientId) {
      return
    }
    console.log('Socket event callback: webrtc_ice_candidate to ' + event.to + " from " + event.from)

    // ICE candidate configuration.
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: event.label,
      candidate: event.candidate,
    })

    if (event.to == 0) {
      if (event.from == 1) { 
        if (this.rtcPeerConnection3 == null) {
          this.rtcPeerConnection1.addIceCandidate(candidate)
        } else {
          this.rtcPeerConnection3.addIceCandidate(candidate)
        }
      } else { // from 2
          this.rtcPeerConnection2.addIceCandidate(candidate)
      } 
      return;
    }
    if (event.to == 1) {
      if (this.rtcPeerConnection2 == null) {
        this.rtcPeerConnection1.addIceCandidate(candidate)
      } else {
        this.rtcPeerConnection2.addIceCandidate(candidate)
      }
      return;
    }
    // to 2
    this.rtcPeerConnection1.addIceCandidate(candidate)
  }

  
  joinRoom(room) {
    if (room === '') {
      throw new Error('Please type a room ID');
    } else {
      this.roomId = room
      socket.emit('join', {roomId: this.roomId})
    }
  }

  async setLocalStream() {
    let stream
    stream = await navigator.mediaDevices.getUserMedia(mediaConstraints)
    this.localStream = stream
    this.localVideo.srcObject = stream
  }

  addLocalTracks(rtcPeerConnection) {
    this.localStream.getTracks().forEach((track) => {
      rtcPeerConnection.addTrack(track, this.localStream)
    })
  }
  addRelayTracks(rtcPeerConnection, stream) {
    stream.getTracks().forEach((track) => {
      rtcPeerConnection.addTrack(track, stream)
    })
  }

  async createOffer(rtcPeerConnection, target) {
    let sessionDescription
    sessionDescription = await rtcPeerConnection.createOffer()
    rtcPeerConnection.setLocalDescription(sessionDescription)
    console.log("Sending offer from " + this.clientId + " to " + target);
    this.socket.emit('webrtc_offer', {
      type: 'webrtc_offer',
      sdp: sessionDescription,
      from: this.clientId, 
      to: target, 
      roomId: this.roomId
    })
  }

  async createAnswer(rtcPeerConnection, target) {
    let sessionDescription
    sessionDescription = await rtcPeerConnection.createAnswer()
    rtcPeerConnection.setLocalDescription(sessionDescription)
    console.log("Sending answer from " + this.clientId + " to " + target);
    this.socket.emit('webrtc_answer', {
      type: 'webrtc_answer',
      sdp: sessionDescription,
      from: this.clientId,
      to: target,
      roomId: this.roomId,
    })
  }

  setRemoteStream1(event) {
    console.log("Setting Remote Stream 1 from client " + this.clientId);
    console.log(event)

    if (this.streamAdded == null) {
      this.streamAdded = event.streams[0]["id"];
      this.remoteVideo1.srcObject = event.streams[0]
      this.remoteStream1 = event.streams[0]
      return;
    }
    // if clientId = 2 digg out additional tracks/streams
    if (this.clientId == 2 && event.streams[0]["id"] != this.streamAdded) {
      this.remoteVideo2.srcObject = event.streams[0];
      this.remoteStream2 = event.streams[0];
    }
    if (this.clientId == 0 && !this.startedRelay) {
      this.startedRelay = true;
      setTimeout(function () {
        this.onStartCall({'from':2,'to': 0});
      }.bind(this),10000);
    }
  }

  setRemoteStream2(event) {
   this.remoteVideo2.srcObject = event.streams[0]
   this.remoteStream2 = event.streams[0]
   if (this.clientId == 0 && !this.startedRelay2) {
      this.startedRelay2 = true;
      setTimeout(function () {
        this.onStartCall({'from':1,'to': 0});
      }.bind(this),10000);
    }

  }

  setRemoteStream3(event) {
     // console nothing to do, no tracks received in this connection
     // just a relay
  }

  sendIceCandidate1(event) {
    let toPeer
    if (this.clientId == 0) {
        toPeer = 1
    }
    if (this.clientId == 1) {
      toPeer = 0
    }
    if (this.clientId == 2) {
      toPeer = 0
    }
    if (event.candidate) {
      this.socket.emit('webrtc_ice_candidate', {
        roomId: this.roomId,
        label: event.candidate.sdpMLineIndex,
        candidate: event.candidate.candidate,
        to: toPeer,
        from: this.clientId
      })
   }
  }

  sendIceCandidate2(event) {
    let toPeer
    if (this.clientId == 0) {
      toPeer = 2
    }
    if (this.clientId == 1) {
      toPeer = 0
    }
    if (event.candidate) {
      this.socket.emit('webrtc_ice_candidate', {
        roomId: this.roomId,
        label: event.candidate.sdpMLineIndex,
        candidate: event.candidate.candidate,
        to: toPeer,
        from: this.clientId
      })
    }
  }

  sendIceCandidate3(event) {
    if (event.candidate) {
      this.socket.emit('webrtc_ice_candidate', {
        roomId: this.roomId,
        label: event.candidate.sdpMLineIndex,
        candidate: event.candidate.candidate,
        to: 1,
        from: 0
      })
    }
  }


  onHangUp(event) {
    if (event.from == 0) {
      this.hangUp();
      return;
    }
    if (this.clientId == 0) {
      if (event.from == 1) {
        this.close1();
      } else {
        this.close2();
      }
      return;
    }
    this.close2();
  }

  close1() {
    console.log("Hanging up connection 1")
    this.remoteVideo1.style = 'display: none'
    this.remoteVideo1.src = "";
    if (this.rtcPeerConnection1) this.rtcPeerConnection1.close();
    this.closeSingleStream(this.remoteStream1);
    this.rtcPeerConnection1 = this.remoteStream1 = undefined;
  }
  close2() {
    console.log("Hanging up connection 2")
    this.remoteVideo2.style = 'display: none'
    this.remoteVideo2.src = "";
    if (this.rtcPeerConnection2) this.rtcPeerConnection2.close();
    this.closeSingleStream(this.remoteStream2);
    this.rtcPeerConnection2 = this.remoteStream2 = undefined;
  }
  closeSingleStream (stream) {
    if (stream) {
      var tracks = stream.getTracks();
      if (tracks) {
        tracks.forEach(function(track) {
          track.stop();
         });
      }
    }
  };


  hangUp() {
    console.log("Hanging up all")
    this.localVideo.style = this.remoteVideo1.style = this.remoteVideo2.style = 'display: none'
    this.remoteVideo1.src = this.remoteVideo2.src =  this.localVideo.src = "";
    if (this.rtcPeerConnection1) this.rtcPeerConnection1.close();
    if (this.rtcPeerConnection2) this.rtcPeerConnection2.close();
    this.closeSingleStream(this.localStream);
    this.closeSingleStream(this.remoteStream1);
    this.closeSingleStream(this.remoteStream2);
    this.rtcPeerConnection1 = this.rtcPeerConnection2 = this.localStream = this.remoteStream1 = this.remoteStream2 = undefined;
    this.socket.emit('hangup', {
        roomId: this.roomId,
        from: this.clientId
    });
  }
}
