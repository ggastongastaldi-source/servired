'use strict';
module.exports = async function eventLogger(event, next) {
  const t = Date.now();
  await next();
  if (process.env.NODE_ENV !== 'production') console.log(`[Bus] ${event.type} ${Date.now()-t}ms`);
};
