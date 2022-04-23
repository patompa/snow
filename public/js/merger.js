// Adapted from
// https://github.com/ant-media/StreamApp/blob/master/src/main/webapp/js/stream_merger.js

class StreamMerger{
  constructor(width=400, height=300, num_streams=2){
      this.streams = [];
      this.width = width*num_streams;
      this.height = height;
      const AudioContext = window.AudioContext || window.webkitAudioContext
      this.audioCtx = new AudioContext();
      this.audioDestination = this.audioCtx.createMediaStreamDestination()

      this.aspectRatio = width/height;
      this.stream_height = height;
      this.stream_width = width;

      this.canvas = document.createElement('canvas');
      this.canvas.setAttribute('width', this.width);
      this.canvas.setAttribute('height', this.height);
      this.ctx = this.canvas.getContext('2d');

      this.streamCount = 0;
      this.frameCount = 0;

      // delay node for video sync
      this.videoSyncDelayNode = this.audioCtx.createDelay(5.0)
      this.videoSyncDelayNode.connect(this.audioDestination)

      this.started = false;
      this.fps = 30;
  }

  getResult(){
      return this.result;
  }

  addStream(mediaStream) {
      this.streamCount ++;
      const stream = {}
      this.audioCtx.resume();
      stream.streamId = mediaStream.id;

      stream.width = this.stream_width;
      stream.height = this.stream_height;
      stream.x = (this.streamCount-1) * this.stream_width;
      stream.y = 0;
      stream.aspectRatio = this.aspectRatio;

      let videoElement = null
      videoElement = document.createElement('video');
      videoElement.autoplay = true;
      videoElement.muted = true;
      videoElement.srcObject = mediaStream;
      videoElement.setAttribute('style', 'position:fixed; left: 0px; top:0px; display: none pointer-events: none; opacity:0;');
      document.body.appendChild(videoElement);

      stream.audioSource = this.audioCtx.createMediaStreamSource(mediaStream)
      stream.audioGainNode = this.audioCtx.createGain() // Intermediate gain node
      stream.audioGainNode.gain.value = 1
      stream.audioSource.connect(stream.audioGainNode).connect(this.audioDestination) // Default is direct connect
      stream.element = videoElement
      this.streams.push(stream);
    }

    requestAnimationFrameV2(callback) {
      let fired = false
      const interval = setInterval(() => {
        if (!fired && document.hidden) {
          fired = true
          clearInterval(interval)
          callback()
        }
      }, 1000 / this.fps)
      requestAnimationFrame(() => {
        if (!fired) {
          fired = true
          clearInterval(interval)
          callback()
        }
      })
    }

    start() {
      this.started = true
      this.requestAnimationFrameV2(this.draw.bind(this))
    
      // Get the result of merged stream canvas
      this.result = this.canvas.captureStream(this.fps)

      // Remove "dead" audio track
      const deadTrack = this.result.getAudioTracks()[0]
      if (deadTrack) this.result.removeTrack(deadTrack)

      // Add audio
      const audioTracks = this.audioDestination.stream.getAudioTracks()
      this.result.addTrack(audioTracks[0])
    }

    draw() {
      if (!this.started) return;
      this.frameCount++;
    
      let awaiting = this.streams.length;
      const done = () => {
        awaiting--;
        if (awaiting <= 0) {
          this.requestAnimationFrameV2(this.draw.bind(this));
        }
      }
      this.streams.forEach((stream) => {
      // default draw function
          const width = stream.width;
          const height = stream.height;
          this.ctx.drawImage(stream.element, stream.x, stream.y, width, height)
          done()
      })
    
      if (this.streams.length === 0) done()
    }

    removeStream(streamId) { 
      let removed = false;
      for (let i = 0; i < this.streams.length; i++) {
        const stream = this.streams[i]
        if (streamId === stream.streamId) {
          if (stream.element) {
            stream.element.remove()
          }
          removed = true;
          this.streams[i] = null
          this.streams.splice(i, 1)
          i--
        }
      }
      console.log("removed streamId = " + streamId);

    }

    stop() {
      this.started = false
    
      this.streams.forEach(stream => {
        if (stream.element) {
          stream.element.remove()
        }
      })
      this.streams = []
      this.audioCtx.close()
      this.audioCtx = null
      this.audioDestination = null
      this.videoSyncDelayNode = null
    
      this.result.getTracks().forEach((track) => {
        track.stop()
      })
    
      this.result = null
    }
    
}
