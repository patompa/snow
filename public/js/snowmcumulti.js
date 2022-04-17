
class SnowMCUMulti extends SnowBase {
  constructor(stats, options) {
    super(stats,options);
    this.remoteStreams = [];
    this.rtcPeerConnections = []
    this.mergedStreams = [];
    this.currentIdx = 0;
  }
  setLocalVideo(localVideo) {
  }
  setRemoteVideos(remoteVideos) {
    this.remoteVideo = document.getElementById(remoteVideos[0]);
    return this;
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
  
  initMerger() {
    let ch = document.getElementById('local-video').getBoundingClientRect().height;
    let cw = document.getElementById('local-video').getBoundingClientRect().width;
    this.merger = new StreamMerger(cw-2,ch,3);
    this.merger.addStream(this.localStream)
    this.merger.start();
  }
  mergeStream(stream) {
    this.currentIdx += 1;
    this.merger.addStream(stream)
  }



  async onStartCall(event) {
    let to = event.to
    let from = event.from
    if (this.clientId != 0) {
      return
    }
    console.log('Socket event callback: start_call to ' + to + ' from ' + from)

    let pc = new RTCPeerConnection(this.iceServers);
    this.rtcPeerConnections.push(pc);
    if (this.rtcPeerConnections.length == 1) {
      this.initMerger();
    }
    this.addRelayTracks(pc,this.merger.getResult());
    pc.ontrack = this.setRemoteStream.bind(this);
    pc.onicecandidate = this.sendIceCandidate.bind(this);
    await this.createOffer(pc, event.from)
  }

  async onWebRTCOffer(event) {
    if (event.to != this.clientId) {
      return;
    }
    console.log('Socket event callback: webrtc_offer to ' + event.to + " from " + event.from);
    let pc = new RTCPeerConnection(this.iceServers);
    this.addRelayTracks(pc, this.localStream);
    pc.ontrack = this.setRemoteStream.bind(this);
    pc.onicecandidate = this.sendIceCandidate.bind(this);
    pc.setRemoteDescription(new RTCSessionDescription(event.sdp));
    this.rtcPeerConnections.push(pc);
    await this.createAnswer(pc,0);
  };

  async onWebRTCAnswer(event) {
    if (event.to != this.clientId) {
      return;
    }
    console.log('Socket event callback: webrtc_answer to ' + event.to + ' from ' + event.from)
    this.rtcPeerConnections[this.rtcPeerConnections.length-1].setRemoteDescription(new RTCSessionDescription(event.sdp));
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
    this.rtcPeerConnections[this.rtcPeerConnections.length-1].addIceCandidate(candidate);
  }


  setRemoteStream(event) {
    console.log("Setting Remote Stream from client " + this.clientId);
    console.log(event)

    let remote = event.streams[0];
    if (this.clientId == 0) {
      console.log("Merged stream  " + this.mergedStreams);
      if  (!this.mergedStreams.includes(remote.id)) {
        this.mergeStream(remote);
        this.remoteVideo.srcObject = this.merger.getResult();
        this.remoteStreams.push(remote);
        this.mergedStreams.push(remote.id);
      }
      if (this.rtcPeerConnections.length == 2) {
        this.stats.init(this.rtcPeerConnections);
      }
    } else {
      this.remoteVideo.srcObject = remote;
      this.remoteStreams.push(remote);
      this.stats.init(this.rtcPeerConnections);
    }

    this.resizeRemote(1,3);
  }

  sendIceCandidate(event) {
    let toPeer
    if (this.clientId == 0) {
      toPeer = this.rtcPeerConnections.length;
    } else  {
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
    this.tearDown();
    this.leave();
    this.hangupDone();
  }

  hangUp() {
    this.tearDown();
    this.hangupDone();
  }

  tearDown() {
    console.log("Hanging up all")
    this.remoteVideo.style = 'display: none'
    this.remoteVideo.src = "";
    for (let i = 0; i < this.rtcPeerConnections.length; i++) {
        let pc = this.rtcPeerConnections[i];
        pc.close();
    }
    if (this.localStream) {
      this.closeSingleStream(this.localStream);
    }
    for (let i = 0; i < this.remoteStreams.length; i++) {
      this.closeSingleStream(this.remoteStreams[i]);
    }
    this.rtcPeerConnections = []
    this.remoteStreams = [];
    if (this.clientId == 0) {
      this.socket.emit('hangup', {
          roomId: this.roomId,
          from: this.clientId
      });
    }
  }
}
