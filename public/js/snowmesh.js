
class SnowMesh extends SnowBase {
  constructor(stats, options) {
    super(stats,options);
    this.remoteStream1 = null;
    this.remoteStream2 = null;
    this.rtcPeerConnection1 = null; // OFFER->ANSWER: 0->1, 1<-0, 2<-0
    this.rtcPeerConnection2 = null; // OFFER->ANSWER: 0->2, 1->2, 2<-1
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

  async onRoomJoined(event) {
    console.log('Socket event callback: room_joined by ' + event.clientId)
    this.clientId = event.clientId
    this.roomId = event.roomId
    await this.setLocalStream()
    this.socket.emit('start_call', {roomId: this.roomId, to: 0, from: this.clientId})
    if (this.clientId == 2) {
      this.socket.emit('start_call', {roomId: this.roomId, to: 1, from: 2})
    }
  }

  async onStartCall(event) {
    let to = event.to
    let from = event.from
    if (this.clientId != to) {
      return
    }
    console.log('Socket event callback: start_call to ' + to + ' from ' + from)
    if (to == 0 && from == 1) {
      this.rtcPeerConnection1 = new RTCPeerConnection(this.iceServers)
      this.addLocalTracks(this.rtcPeerConnection1)
      this.rtcPeerConnection1.ontrack = this.setRemoteStream1.bind(this)
      this.rtcPeerConnection1.onicecandidate = this.sendIceCandidate1.bind(this)
      await this.createOffer(this.rtcPeerConnection1, from)
    }
    if ((to == 0 && from == 2) || (to == 1 && from == 2)) {
      this.rtcPeerConnection2 = new RTCPeerConnection(this.iceServers)
      this.addLocalTracks(this.rtcPeerConnection2)
      this.rtcPeerConnection2.ontrack = this.setRemoteStream2.bind(this)
      this.rtcPeerConnection2.onicecandidate = this.sendIceCandidate2.bind(this)
      await this.createOffer(this.rtcPeerConnection2, from)
    }
  }

  async onWebRTCOffer(event) {
    if (event.to !=this.clientId) {
      return;
    }
    console.log('Socket event callback: webrtc_offer to ' + event.to + " from " + event.from)

    if ((event.to == 2 && event.from == 0) || (event.to == 1 && event.from == 0)) {
      this.rtcPeerConnection1 = new RTCPeerConnection(this.iceServers)
      this.addLocalTracks(this.rtcPeerConnection1)
      this.rtcPeerConnection1.ontrack = this.setRemoteStream1.bind(this)
      this.rtcPeerConnection1.onicecandidate = this.sendIceCandidate1.bind(this)
      this.rtcPeerConnection1.setRemoteDescription(new RTCSessionDescription(event.sdp))
      await this.createAnswer(this.rtcPeerConnection1,event.from)
    }
    if (event.to == 2 && event.from == 1) {
      this.rtcPeerConnection2 = new RTCPeerConnection(this.iceServers)
      this.addLocalTracks(this.rtcPeerConnection2)
      this.rtcPeerConnection2.ontrack = this.setRemoteStream2.bind(this)
      this.rtcPeerConnection2.onicecandidate = this.sendIceCandidate2.bind(this)
      this.rtcPeerConnection2.setRemoteDescription(new RTCSessionDescription(event.sdp))
      await this.createAnswer(this.rtcPeerConnection2, event.from)
    }
  };

  async onWebRTCAnswer(event) {
    if (event.to != this.clientId) {
      return;
    }
    console.log('Socket event callback: webrtc_answer to ' + event.to + ' from ' + event.from)
    if (event.to == 0 && event.from == 1) {
      this.rtcPeerConnection1.setRemoteDescription(new RTCSessionDescription(event.sdp))
    }
    if ((event.to == 0 && event.from == 2) || (event.to == 1 && event.from == 2)) {
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
      } else { 
        this.rtcPeerConnection2.addIceCandidate(candidate)
      }
    }
    if (event.to == 1) {
      if (event.from == 0) {
        this.rtcPeerConnection1.addIceCandidate(candidate)
      } else {
        this.rtcPeerConnection2.addIceCandidate(candidate)
      }
    }

    if (event.to == 2) {
      if (event.from == 0) {
        this.rtcPeerConnection1.addIceCandidate(candidate)
      } else {
        this.rtcPeerConnection2.addIceCandidate(candidate)
      }
    }
  }

  
  setRemoteStream1(event) {
    this.remoteVideo1.srcObject = event.streams[0]
    this.remoteStream1 = event.stream
    this.resizeRemote(1,1);
    if (this.rtcPeerConnection1 != null && this.rtcPeerConnection2 != null) {
      this.stats.init([this.rtcPeerConnection1, this.rtcPeerConnection2]);
    }
  }

  setRemoteStream2(event) {
   this.remoteVideo2.srcObject = event.streams[0]
   this.remoteStream2 = event.stream
   this.resizeRemote(2,1);
   if (this.rtcPeerConnection1 != null && this.rtcPeerConnection2 != null) {
     this.stats.init([this.rtcPeerConnection1, this.rtcPeerConnection2]);
   }
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
      toPeer = 2
    }
    if (this.clientId == 2) {
      toPeer = 1
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

}
