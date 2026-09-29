// Compiles the contract with solc-js (the npm build of the Solidity compiler), so no compiler
// download is needed. Writes artifacts/SysCommanderLeaderboard.json with abi + bytecode.
'use strict';
const fs = require('fs');
const path = require('path');
const solc = require('solc');

const NAME = 'SysCommanderLeaderboard';
const source = fs.readFileSync(path.join(__dirname, '..', 'contracts', `${NAME}.sol`), 'utf8');
const input = {
  language: 'Solidity',
  sources: { [`${NAME}.sol`]: { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'paris',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};
function findImports(p) {
  try { return { contents: fs.readFileSync(require.resolve(p), 'utf8') }; } catch (e) { return { error: `not found: ${p}` }; }
}
const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (out.errors || []).filter((e) => e.severity === 'error');
for (const e of out.errors || []) console.error(e.formattedMessage);
if (errors.length) process.exit(1);
const c = out.contracts[`${NAME}.sol`][NAME];
const artifact = { contractName: NAME, compiler: `solc ${solc.version()}`, abi: c.abi, bytecode: '0x' + c.evm.bytecode.object };
fs.mkdirSync(path.join(__dirname, '..', 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'artifacts', `${NAME}.json`), JSON.stringify(artifact, null, 2) + '\n');
console.log(`compiled ${NAME} with solc ${solc.version()} (${(c.evm.bytecode.object.length / 2)} bytes)`);
