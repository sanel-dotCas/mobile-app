// Simple structuredClone polyfill for jest environment
module.exports = function structuredClone(obj) {
  return JSON.parse(JSON.stringify(obj));
};
module.exports.default = module.exports;
