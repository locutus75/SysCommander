// Tests for the address -> player name generator (js/names.js).
// Usage: node tools/test-names.js
'use strict';
const N = require('../js/names.js');

let failed = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failed++; };

check('64 unique adjectives', N.ADJECTIVES.length === 64 && new Set(N.ADJECTIVES).size === 64);
check('64 unique nouns', N.NOUNS.length === 64 && new Set(N.NOUNS).size === 64);

const a = '0x3fA85f64C7aB1e2D9c0B1a2e3F4d5C6b7A8e3F2a';
check('stable for the same address', N.nameFromAddress(a) === N.nameFromAddress(a));
check('ignores upper/lower case and 0x', N.nameFromAddress(a) === N.nameFromAddress(a.toLowerCase().slice(2)));
check('ends with the last 4 hex characters', N.nameFromAddress(a).endsWith('#3F2A'));
check('rejects a bad address', (() => { try { N.nameFromAddress('0x1234'); return false; } catch (e) { return true; } })());

// spread: random addresses should give many different adjective/noun pairs
let seed = 7;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) >>> 24).toString(16).padStart(2, '0');
const pairs = new Set();
const examples = [];
for (let i = 0; i < 2000; i++) {
  const addr = '0x' + Array.from({ length: 20 }, rnd).join('');
  const name = N.nameFromAddress(addr);
  pairs.add(name.replace(/ #.*/, ''));
  if (i < 6) examples.push(`${N.shortAddress(addr)}  ->  ${name}`);
}
check('2000 addresses give over 1000 different name pairs', pairs.size > 1000);
console.log('\nexamples:\n  ' + examples.join('\n  '));

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
