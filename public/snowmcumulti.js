
class SnowMCUMulti {
  constructor(options) {
    this.localStream = null;
    this.remoteStreams = [];
    this.rtcPeerConnections = []
    this.roomId = null;
    this.clientId = -1;
    this.merger = new StreamMerger(400,300,true,4/3);
    this.mergedStreams = [];
  }
  setLocalVideo(localVideo) {
  }
  setRemoteVideos(remoteVideos) {
    this.remoteVideo = document.getElementById(remoteVideos[0]);
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
  async onRoomJoined(event) {
    console.log('Socket event callback: room_joined by ' + event.clientId)
    this.clientId = event.clientId
    this.roomId = event.roomId
    await this.setLocalStream()
    if (this.clientId > 0) {
      this.socket.emit('start_call', {roomId: this.roomId, to: 0, from: this.clientId})
    }
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
    this.addTracks(pc,this.merger.getResult());
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
    this.addTracks(pc, this.localStream);
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
    if (this.clientId == 0) {
      this.merger.addStream(this.localStream, {streamId: this.localStream.id});
      this.merger.start()
    }
  }

  addTracks(rtcPeerConnection, stream) {
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

  setRemoteStream(event) {
    console.log("Setting Remote Stream from client " + this.clientId);
    console.log(event)

    let remote = event.streams[0];
    if (this.clientId == 0) {
      console.log("Merged stream  " + this.mergedStreams);
      if  (!this.mergedStreams.includes(remote.id)) {
        this.merger.addStream(remote, {streamId: remote.id});
        this.remoteVideo.srcObject = this.merger.getResult();
        this.remoteStreams.push(remote);
        this.mergedStreams.push(remote.id);
      }
    } else {
      this.remoteVideo.srcObject = remote;
      this.remoteStreams.push(remote);
    }
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
    this.hangUp();
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
