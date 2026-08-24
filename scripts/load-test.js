#!/usr/bin/env node
// Engagio Load Test - simulates 200 concurrent quiz starts + submissions
// Usage: node scripts/load-test.js --quizLinkId <ID> --cookie "session-token=..." --users 200
const https = require("https");
const http = require("http");

function parseArgs() {
  const a = process.argv.slice(2);
  const o = { url: "http://localhost:3000", users: 200, quizLinkId: "", cookie: "", phase: "both", ramp: 0 };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === "--url") o.url = a[++i];
    else if (a[i] === "--users") o.users = parseInt(a[++i], 10);
    else if (a[i] === "--quizLinkId") o.quizLinkId = a[++i];
    else if (a[i] === "--cookie") o.cookie = a[++i];
    else if (a[i] === "--phase") o.phase = a[++i];
    else if (a[i] === "--ramp") o.ramp = parseInt(a[++i], 10);
  }
  return o;
}

function request(method, url, body, cookie, timeoutMs) {
  timeoutMs = timeoutMs || 30000;
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const headers = { "Content-Type": "application/json", "Cookie": cookie };
    if (body) headers["Content-Length"] = Buffer.byteLength(JSON.stringify(body));
    const start = Date.now();
    const req = mod.request(url, { method, headers, timeout: timeoutMs }, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(data); } catch(e) {}
        resolve({ status: res.statusCode, body: json, time: Date.now() - start });
      });
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function computeStats(results) {
  const times = results.map(r => r.time).sort((a, b) => a - b);
  const success = results.filter(r => r.status >= 200 && r.status < 300);
  const errors = results.filter(r => r.status >= 400 || r.error);
  const p = (arr, pct) => arr[Math.floor(arr.length * pct)] || 0;
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const errMap = {};
  errors.forEach(r => { const k = r.error || "HTTP " + r.status; errMap[k] = (errMap[k] || 0) + 1; });
  const maxTime = Math.max(...times, 1);
  return {
    total: results.length, success: success.length, errors: errors.length,
    rate: ((success.length / results.length) * 100).toFixed(1) + "%",
    t: { min: times[0] || 0, avg: Math.round(avg(times)), p50: p(times, 0.5), p95: p(times, 0.95), p99: p(times, 0.99), max: times[times.length - 1] || 0 },
    errMap, throughput: (results.length / (maxTime / 1000)).toFixed(1)
  };
}

function print(label, s) {
  const bar = "============================================================";
  console.log("\n" + bar);
  console.log("  " + label);
  console.log(bar);
  console.log("  Total:        " + s.total);
  console.log("  Success:      " + s.success + " (" + s.rate + ")");
  console.log("  Failed:       " + s.errors);
  console.log("  Throughput:   " + s.throughput + " req/s");
  console.log("\n  Response times:");
  console.log("    Min:  " + s.t.min + "ms");
  console.log("    Avg:  " + s.t.avg + "ms");
  console.log("    P50:  " + s.t.p50 + "ms");
  console.log("    P95:  " + s.t.p95 + "ms");
  console.log("    P99:  " + s.t.p99 + "ms");
  console.log("    Max:  " + s.t.max + "ms");
  if (Object.keys(s.errMap).length) {
    console.log("\n  Errors:");
    Object.keys(s.errMap).forEach(k => console.log("    " + k + ": " + s.errMap[k]));
  }
  console.log(bar);
}

async function main() {
  const o = parseArgs();
  if (!o.quizLinkId) { console.error("Error: --quizLinkId required"); process.exit(1); }
  if (!o.cookie) { console.error("Error: --cookie required"); process.exit(1); }
  const base = o.url.replace(/\/$/, "");

  console.log("\n  Engagio Load Test");
  console.log("  Target:    " + base);
  console.log("  Users:     " + o.users);
  console.log("  Quiz:      " + o.quizLinkId);
  console.log("  Phase:     " + o.phase);
  console.log("  Ramp:      " + o.ramp + "s\n");

  if (o.phase === "start" || o.phase === "both") {
    console.log("Phase 1: Starting " + o.users + " concurrent quizzes...");
    const results = [];
    const go = async (i) => {
      try {
        const r = await request("POST", base + "/api/attempts/start", { quizLinkId: o.quizLinkId }, o.cookie);
        results.push({ userId: i, status: r.status, time: r.time, body: r.body });
        process.stdout.write(r.status === 200 ? "." : "x");
      } catch (e) {
        results.push({ userId: i, status: 0, time: 0, error: e.message });
        process.stdout.write("x");
      }
    };
    const t0 = Date.now();
    if (o.ramp > 0) {
      const delay = (o.ramp * 1000) / o.users;
      for (let i = 0; i < o.users; i++) {
        ((idx) => setTimeout(() => go(idx), idx * delay))(i);
      }
      await new Promise(r => setTimeout(r, o.ramp * 1000 + 10000));
    } else {
      await Promise.all(Array.from({ length: o.users }, (_, i) => go(i)));
    }
    console.log("\n  Done in " + ((Date.now() - t0) / 1000).toFixed(1) + "s");
    const stats = computeStats(results);
    print("QUIZ START RESULTS", stats);

    if (o.phase === "submit" || o.phase === "both") {
      const ids = results.filter(r => r.status === 200 && r.body && r.body.attemptId).map(r => r.body.attemptId);
      if (ids.length === 0) { console.log("  No attempts to submit."); return; }
      console.log("\nPhase 2: Submitting " + ids.length + " quizzes...");
      const subResults = [];
      const subGo = async (id) => {
        try {
          const r = await request("POST", base + "/api/attempts/submit", {
            attemptId: id, answers: {}, timeTaken: 60,
            tabSwitches: 0, fullscreenExits: 0, copyAttempts: 0, rightClicks: 0,
            devtoolsOpen: 0, screenshotAttempts: 0, keyboardViolations: 0,
            faceNotDetected: 0, multiFaceAlerts: 0, lookAwayAlerts: 0, flaggedQuestions: []
          }, o.cookie);
          subResults.push({ status: r.status, time: r.time });
          process.stdout.write(r.status === 200 ? "." : "x");
        } catch (e) {
          subResults.push({ status: 0, time: 0, error: e.message });
          process.stdout.write("x");
        }
      };
      const t1 = Date.now();
      await Promise.all(ids.map(id => subGo(id)));
      console.log("\n  Done in " + ((Date.now() - t1) / 1000).toFixed(1) + "s");
      print("QUIZ SUBMIT RESULTS", computeStats(subResults));
    }
  }

  console.log("\n  Load test complete.");
  console.log("  Vercel Free = 10 concurrent functions. Pro = 50.");
  console.log("  P95 > 5s is normal under 200-user load on free tier.\n");
}

main().catch(e => { console.error("Failed:", e); process.exit(1); });

