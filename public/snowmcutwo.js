
class SnowMCUTwo {
  constructor(stats,options) {
    this.localStream = null;
    this.remoteStream1 = null;
    this.remoteStream2 = null;
    this.rtcPeerConnection1 = null; // OFFER->ANSWER: 0->1, 1<-0, 2<-0
    this.rtcPeerConnection2 = null; // OFFER->ANSWER: 0->2, 1->2, 2<-1
    this.roomId = null;
    this.clientId = -1;
    this.mergedStreams1 = [];
    this.mergedStreams2 = [];
    this.stats = stats;
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
    if (this.clientId > 0) {
      this.socket.emit('start_call', {roomId: this.roomId, to: 0, from: this.clientId})
    }

  }
  async onFullRoom() {
    console.log("Room full");
    throw Error("Room full");
  }

  initMerger() {
    let ch = document.getElementById('local-video').getBoundingClientRect().height;
    let cw = document.getElementById('local-video').getBoundingClientRect().width;
    let merger = new StreamMerger(cw*2-2,ch,false,cw/ch);
    merger.addStream(this.localStream, {streamId: this.localStream.id, width: cw, height: ch, aspectRatio: cw/ch});
    merger.start();
    return merger;
  }
  mergeStream(merger,stream) {
    let ch = document.getElementById('local-video').getBoundingClientRect().height;
    let cw = document.getElementById('local-video').getBoundingClientRect().width;
    merger.addStream(stream, {streamId: stream.id, width: cw, height: ch, aspectRatio: cw/ch,  Xindex:1});
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
      this.merger1 = this.initMerger();
      this.merger2 = this.initMerger();
      this.addRelayTracks(this.rtcPeerConnection1,this.merger1.getResult());
      this.rtcPeerConnection1.ontrack = this.setRemoteStream1.bind(this)
      this.rtcPeerConnection1.onicecandidate = this.sendIceCandidate1.bind(this)
      await this.createOffer(this.rtcPeerConnection1, 1)
    } else {
      this.rtcPeerConnection2 = new RTCPeerConnection(this.iceServers)
      this.addRelayTracks(this.rtcPeerConnection2,this.merger2.getResult());
      this.rtcPeerConnection2.ontrack = this.setRemoteStream2.bind(this)
      this.rtcPeerConnection2.onicecandidate = this.sendIceCandidate2.bind(this)
      await this.createOffer(this.rtcPeerConnection2, 2)
    }
  }

  async onWebRTCOffer(event) {
    if (event.to !=this.clientId) {
      return;
    }
    console.log('Socket event callback: webrtc_offer to ' + event.to + " from " + event.from)
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
      this.rtcPeerConnection1.setRemoteDescription(new RTCSessionDescription(event.sdp))
    } else { 
      // from 2
      this.rtcPeerConnection2.setRemoteDescription(new RTCSessionDescription(event.sdp))
    }
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
          this.rtcPeerConnection1.addIceCandidate(candidate)
      } else { // from 2
          this.rtcPeerConnection2.addIceCandidate(candidate)
      } 
      return;
    } else {
      this.rtcPeerConnection1.addIceCandidate(candidate)
    }
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
    document.getElementById('local-video').style.width = "256px";
    document.getElementById('local-video').style.height = "144px";

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

    let remote = event.streams[0];
    if (this.clientId == 0) {
      console.log("Merged stream 1 " + this.mergedStreams1);
      if  (!this.mergedStreams1.includes(remote.id)) {
        this.mergeStream(this.merger2, remote);
        this.mergedStreams1.push(remote.id);
      }
    }
    this.remoteVideo1.srcObject = remote;
    this.remoteStream1 = remote;

    if (this.clientId != 0) {
      let ch = document.getElementById('local-video').getBoundingClientRect().height;
      let cw = document.getElementById('local-video').getBoundingClientRect().width * 2;
      document.getElementById('remote-video1').style.height = ch + "px";
      let percent = 100 * cw / document.body.clientWidth;
      document.getElementById('remote-video1').style.width = percent + "%";
      this.stats.init([this.rtcPeerConnection1]);
    }
  }

  setRemoteStream2(event) {
   let remote = event.streams[0];
   console.log("Merged stream 1 " + this.mergedStreams1);
   if  (!this.mergedStreams2.includes(remote.id)) {
     this.mergeStream(this.merger1, remote);
     this.mergedStreams2.push(remote.id);
   }
   this.remoteVideo2.srcObject = remote;
   this.remoteStream2 = remote;
   this.stats.init([this.rtcPeerConnection1, this.rtcPeerConnection2]);
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
