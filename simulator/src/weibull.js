"use strict";

function weibullSample(eta, beta) {
  const u = Math.random();
  return eta * Math.pow(-Math.log(1 - u), 1 / beta);
}

module.exports = { weibullSample };
