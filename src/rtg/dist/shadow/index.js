"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShadowMonitor = exports.shadowMonitor = void 0;
// index.ts — singleton ShadowMonitor exportable desde server.js
const ShadowMonitor_1 = require("./ShadowMonitor");
Object.defineProperty(exports, "ShadowMonitor", { enumerable: true, get: function () { return ShadowMonitor_1.ShadowMonitor; } });
exports.shadowMonitor = new ShadowMonitor_1.ShadowMonitor();
