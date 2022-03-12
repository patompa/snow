class Stats {
  constructor(targetEl) {
    this.targetEl = targetEl;
    this.stats = []
  }
  collectStats(stat, conn, total) {
    let statsOutput = "";
    stat.forEach(report => {
      if (report.type !== "outbound-rtp" && report.type !== "inbound-rtp") {
        return;
      }
      if (report.id.startsWith("RTCOutboundRTPAudioStream") || report.id.startsWith("RTCInboundRTPAudioStream")) {
        return;
      };
      statsOutput += `<h2>${conn} Report: ${report.type}</h2>\n<strong>ID:</strong> ${report.id}<br>\n` +
               `<strong>Timestamp:</strong> ${report.timestamp}<br>\n`;
      // Now the statistics for this report; we intentionally drop the ones we
      // sorted to the top above
      // just look at inound and outbound video performance
      Object.keys(report).forEach(statName => {
        if (statName !== "id" && statName !== "timestamp" && statName !== "type") {
          statsOutput += `<strong>${statName}:</strong> ${report[statName]}<br>\n`;
        }
      });
    });
    this.stats.push(statsOutput);
    if (this.stats.length == total) {
      console.log("Updating stats");
      let html = "";
      for (let i = 0; i < total; i++) {
        html += this.stats[i];
      }
      document.getElementById(this.targetEl).innerHTML = html;
      this.stats = [];
    }
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
