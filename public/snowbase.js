class SnowBase {
  constructor(stats,options) {
    this.localStream = null;
    this.roomId = null;
    this.clientId = -1;
    this.stats = stats;
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
    this.clientId = 0;
    await this.setLocalStream()
  }

  joinRoom(room) {
    if (room === '') {
      throw new Error('Please type a room ID');
    } else {
      this.roomId = room
      socket.emit('join', {roomId: this.roomId})
    }
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



  async setLocalStream() {
    let stream
    console.log("Getting local stream");
    stream = await navigator.mediaDevices.getUserMedia(mediaConstraints)
    this.localStream = stream
    console.log("Got local stream");
    document.getElementById('local-video').style.width = "256px";
    document.getElementById('local-video').style.height = "144px";
    if (this.localVideo !== undefined) {
      this.localVideo.srcObject = stream
    }
  }

  setModel(model) {
    this.model = model;
  }

  async onFullRoom() {
    console.log("Room full");
    throw Error("Room full");
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


  resizeRemote(remoteId, size) {
   let ch = document.getElementById('local-video').getBoundingClientRect().height;
    let cw = document.getElementById('local-video').getBoundingClientRect().width * size;
    document.getElementById('remote-video' + remoteId).style.height = ch + "px";
    let percent = 100 * cw / document.body.clientWidth;
    document.getElementById('remote-video' + remoteId).style.width = percent + "%";
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
    this.leave();
    this.hangupDone();
  }
  leave() {
     this.socket.emit('unsubscribe', {
        roomId: this.roomId,
        from: this.clientId
    });
    setTimeout(function () {window.location.reload(true);},3000);
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
    this.hangupDone();
  };

  hangupDone() {
    this.stats.saveStats(this.model);
  };
}
