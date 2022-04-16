class Stats {
  constructor(targetEl) {
    this.targetEl = targetEl;
    this.stats = {}
    this.initStats();
    this.startTime = (new Date().getTime()/1000)
    this.elapsed = 0;
    this.seconds = document.getElementById("seconds");
    var that = this;
    setInterval(function() {that.updateTime()}, 1000);
  } 
  updateTime() {
    this.elapsed = (new Date().getTime()/1000) - this.startTime;
    this.seconds.innerHTML = Math.round(this.elapsed,0);
  }
  initStats() {
    this.statNames = ["jitter","packetsLost","jitterBufferDelay","totalInterFrameDelay"];
    this.statNames.forEach(statName => {
      this.stats[statName] = {"sum":0,"n":0,"sum2":0}
    });
  }
  saveStats(model) {
    let data = localStorage.getItem("stats");
    if (data == null) {
      data  = '{"stats":[]}';
    }
    let report = JSON.parse(data);
    let stat = {'model':model, 'time': new Date().getTime()};
    for (let i=0; i < this.statNames.length; i++) {
      let statName = this.statNames[i];
      let s = this.getStat(statName);
      stat[statName] = s;
    };
    report["stats"].push(stat);
    localStorage.setItem("stats",JSON.stringify(report));
  }
  getStat(statName) {
     let n = this.stats[statName]["n"];
     if (n == 0) {
        return {"mean": 0, "std": 0};
     }
     let tot =  this.stats[statName]["sum"];
     let mean = tot/n;
     let sum2 =  this.stats[statName]["sum2"];
     var std = Math.sqrt((sum2 / n) - (mean * mean));
     return {"mean": mean, "std": std};

  }
  collectStats(stat, conn, total) {
    if (this.elapsed < 60) {
      return;
    }
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
        let stat = this.getStat(statName);
        html += statName + ": " + stat["mean"] + " " + stat["std"]  + "<br>";
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
