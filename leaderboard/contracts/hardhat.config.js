// Hardhat is only used for its local test chain; compilation is done by scripts/compile.js.
require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-chai-matchers');
module.exports = { solidity: '0.8.28', paths: { tests: './test' } };
