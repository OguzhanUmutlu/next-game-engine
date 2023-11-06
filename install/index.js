#!/usr/bin/env node

const child_process = require("child_process");
const os = require("os");

const start = Date.now();
console.log("Installing the engine. Please wait...");
child_process.execSync("git clone https://github.com/OguzhanUmutlu/next-game-engine && cd next-game-engine && npm install");
console.log("Next Game Engine was installed in " + Math.floor((Date.now() - start) / 1000) + " seconds! Now just run the run." + (os.platform() === "win32" ? "cmd or run.vbs" : "sh") + " file!");