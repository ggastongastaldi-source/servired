// index.ts — singleton ShadowMonitor exportable desde server.js
import { ShadowMonitor } from './ShadowMonitor';
export const shadowMonitor = new ShadowMonitor();
export { ShadowMonitor };
