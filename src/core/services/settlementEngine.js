const PLATFORM_FEE_RATE = 0.20;

function calculateSettlement(amount) {
  const platformFee   = Math.round(amount * PLATFORM_FEE_RATE);
  const workerPayout  = amount - platformFee;
  return { platformFee, workerPayout };
}

module.exports = { calculateSettlement };
