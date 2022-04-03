class Stats {
  constructor(targetEl) {
    this.targetEl = targetEl;
    this.stats = {}
    this.initStats();
  } 
  initStats() {
    this.stats["jitter"] = {"sum":0,"n":0,"sum2":0}
    this.stats["packetsLost"] = {"sum":0,"n":0,"sum2":0}
    this.stats["jitterBufferDelay"] = {"sum":0,"n":0,"sum2":0}
    this.stats["framesPerSecond"] = {"sum":0,"n":0,"sum2":0}
    this.stats["totalInterFrameDelay"] = {"sum":0,"n":0,"sum2":0}
  }
  collectStats(stat, conn, total) {
    stat.forEach(report => {
      if (report.type !== "inbound-rtp") {
        return;
      }
      Object.keys(report).forEach(statName => {
        if (statName in this.stats) {
            this.stats[statName]["sum"] += report[statName];
            this.stats[statName]["sum2"] += report[statName] * report[statName];
            this.stats[statName]["n"] += 1
        }
      });
    });

    let html = "";
    Object.keys(this.stats).forEach(statName => {
        let n = this.stats[statName]["n"];
        let tot =  this.stats[statName]["sum"];
        let mean = tot/n;
        let sum2 =  this.stats[statName]["sum2"];
        var std = Math.sqrt((sum2 / n) - (mean * mean));
        html += statName + ": " + mean + " " + std  + "<br>";

        
    });
    document.getElementById(this.targetEl).innerHTML = html;
  }
  init(pcs) {
    let saveStats = this.collectStats.bind(this);
    window.setInterval(function() {
      stats.length = 0;
      console.log("Collecting stats...");
      let statsOutput = "";
      for (let i = 0; i < pcs.length; i++) {
        let myPeerConnection = pcs[i];
        myPeerConnection.getStats(null).then(stat => {
          saveStats(stat, i, pcs.length);
        });
      }
    }, 5000);
  };
};
