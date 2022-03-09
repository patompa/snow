class Snow {
  constructor(model, options) {
    if (model == "Mesh") {
      this.model = new SnowMesh(options);
    } else if (model ==  "SFU") {
      this.model = new SnowSFU(options);
    } else if (model ==  "MCU") {
      this.model = new SnowMCU(options);
    } else if (model ==  "MCUTwo") {
      this.model = new SnowMCUTwo(options);
    } else if (model ==  "MCUMulti") {
      this.model = new SnowMCUMulti(options);
    }
    if ("localVideo" in options) {
      this.model.setLocalVideo(options["localVideo"]);
    }
    if ("remoteVideos" in options) {
      this.model.setRemoteVideos(options["remoteVideos"]);
    }
    if ("mediaConstraints" in options) {
      this.model.setMediaConstraints(options["mediaConstraints"]);
    }
    if ("icServers" in options) {
      this.model.setIceServers(options["iceServers"]);
    }
    if ("socket" in options) {
      this.model.setWebSocket(options["socket"]);
    }
  }

  joinRoom(room) {
    this.model.joinRoom(room);
  }
  hangUp() {
    this.model.hangUp();
  }
}
