// Using internal merger at
// https://github.com/t-mullen/video-stream-merger

class StreamMerger{
  constructor(width=400, height=300, num_streams=2){
     this.width = width*num_streams;
     this.stream_width = width;
     this.height = height;
     this.streamCount = 0;
     this.merger = new VideoStreamMerger({width:this.width,
                                          height: this.height,
                                          fps: 30});
  }
  getResult(){
      return this.merger.result;
  }
  addStream(mediaStream) {
     this.streamCount ++;
     this.merger.addStream(mediaStream, { x: (this.streamCount-1) * this.stream_width,
                                          y: 0,
                                          width: this.stream_width,
                                          height: this.height,
                                          mute: false });
 
  }
  start() {
    this.merger.start();
  }
  removeStream(streamId) { 
    this.merger.removeStream(streamId);
    console.log("removed streamId = " + streamId);
  }
  stop() {
    this.merger.destroy();
  }
}
