'use strict';
/*
 * Turns a wallet address into a fun, stable player name, e.g. "Turbo Pogo Whale #3F2A".
 * Anyone can compute it from the address alone, so nothing extra is stored on chain, and
 * because we own the word lists a name can never be offensive.
 *
 * Algorithm (keep it stable - changing it renames every player):
 *   hex    = address without "0x", lower case (40 hex characters)
 *   adj    = ADJECTIVES[ byte(hex[0..1]) mod 64 ]
 *   noun   = NOUNS[      byte(hex[2..3]) mod 64 ]
 *   tag    = last 4 hex characters, upper case
 *   name   = `${adj} ${noun} #${tag}`
 *   colour = hue byte(hex[4..5]) / 256 * 360, for a badge or name colour
 */
const SysNames = (() => {
  const ADJECTIVES = [
    'Turbo', 'Pixel', 'Neon', 'Merged', 'Orange', 'Sentry', 'Pogo', 'Rolling',
    'Frozen', 'Golden', 'Blue', 'Swift', 'Brave', 'Lucky', 'Quantum', 'Zero',
    'Hodling', 'Lunar', 'Atomic', 'Cosmic', 'Silent', 'Mighty', 'Hyper', 'Stellar',
    'Chained', 'Blocky', 'Epic', 'Retro', 'Laser', 'Rocket', 'Iron', 'Crystal',
    'Electric', 'Arcade', 'Mega', 'Ultra', 'Sonic', 'Wild', 'Clever', 'Bold',
    'Shiny', 'Nimble', 'Steady', 'Plucky', 'Jolly', 'Zippy', 'Dashing', 'Daring',
    'Fearless', 'Loyal', 'Humble', 'Patient', 'Sturdy', 'Radiant', 'Galactic', 'Thunder',
    'Blazing', 'Frosty', 'Sunny', 'Stormy', 'Midnight', 'Crimson', 'Azure', 'Emerald',
  ];
  const NOUNS = [
    'Commander', 'Pogo', 'Whale', 'Miner', 'Node', 'Builder', 'Hodler', 'Validator',
    'Sentry', 'Bridger', 'Blocksmith', 'Satoshi', 'Roller', 'Keygem', 'Chainlock', 'Bull',
    'Rocket', 'Wizard', 'Knight', 'Ranger', 'Pilot', 'Captain', 'Ninja', 'Voyager',
    'Explorer', 'Pioneer', 'Guardian', 'Comet', 'Falcon', 'Tiger', 'Dolphin', 'Otter',
    'Panda', 'Fox', 'Owl', 'Phoenix', 'Dragon', 'Golem', 'Robot', 'Astronaut',
    'Surfer', 'Diver', 'Racer', 'Jumper', 'Blaster', 'Hero', 'Legend', 'Champion',
    'Scout', 'Sprinter', 'Sailor', 'Viking', 'Samurai', 'Paladin', 'Mage', 'Bard',
    'Monk', 'Druid', 'Titan', 'Giant', 'Byte', 'Hash', 'Nonce', 'Oracle',
  ];

  function normalize(address) {
    const hex = String(address || '').trim().toLowerCase().replace(/^0x/, '');
    if (!/^[0-9a-f]{40}$/.test(hex)) throw new Error('not a valid 0x address: ' + address);
    return hex;
  }
  const byte = (hex, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16);

  function nameFromAddress(address) {
    const hex = normalize(address);
    return `${ADJECTIVES[byte(hex, 0) % 64]} ${NOUNS[byte(hex, 1) % 64]} #${hex.slice(-4).toUpperCase()}`;
  }
  function colorFromAddress(address) {
    const hex = normalize(address);
    return `hsl(${Math.round((byte(hex, 2) / 256) * 360)}, 75%, 62%)`;
  }
  const shortAddress = (address) => { const hex = normalize(address); return `0x${hex.slice(0, 4)}...${hex.slice(-4)}`; };

  return { nameFromAddress, colorFromAddress, shortAddress, ADJECTIVES, NOUNS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SysNames;
