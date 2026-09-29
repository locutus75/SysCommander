// The game encodes its three contract calls by hand (js/leaderboard.js, no libraries).
// These tests check that encoding against the real ABI and a deployed contract.
const { expect } = require('chai');
const { ethers } = require('hardhat');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const artifact = require('../artifacts/SysCommanderLeaderboard.json');

function loadLeaderboardJs() {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'js', 'leaderboard.js'), 'utf8');
  const ctx = vm.createContext({ window: {}, BigInt, Number, String, parseInt, Math, JSON, Promise });
  vm.runInContext(src + '\nthis.__lb = Leaderboard;', ctx);
  return ctx.__lb;
}

describe('game-side ABI encoding (js/leaderboard.js)', function () {
  const iface = new ethers.Interface(artifact.abi);
  const LB = loadLeaderboardJs();

  it('is disabled without a configured contract', () => {
    expect(LB.enabled).to.equal(false);
  });

  it('uses the right function selectors', () => {
    expect(LB.SELECTOR.submitScore).to.equal(iface.getFunction('submitScore').selector);
    expect(LB.SELECTOR.top).to.equal(iface.getFunction('top').selector);
  });

  it('encodes submitScore exactly like ethers', () => {
    const sig = '0x' + 'ab'.repeat(65);
    const runHash = ethers.keccak256(ethers.toUtf8Bytes('run'));
    expect(LB.encodeSubmit(3, 123456, 789, runHash, sig)).to.equal(iface.encodeFunctionData('submitScore', [3, 123456, 789, runHash, sig]));
  });

  it('decodes top() results, empty and full', async () => {
    const [owner, referee, ...players] = await ethers.getSigners();
    expect(LB.decodeTop(iface.encodeFunctionResult('top', [[]]))).to.deep.equal([]);
    const entries = players.slice(0, 3).map((p, i) => [p.address, 1000 - i, 60 + i, 1700000000 + i]);
    const decoded = LB.decodeTop(iface.encodeFunctionResult('top', [entries]));
    expect(decoded.map((e) => [ethers.getAddress(e.player), e.score, e.secs, e.at])).to.deep.equal(entries);
  });

  it('round-trips against a deployed contract', async () => {
    const [owner, referee, alice] = await ethers.getSigners();
    const board = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, owner).deploy(referee.address);
    const t = (await ethers.provider.getBlock('latest')).timestamp;
    await board.setSeason(7, t - 1, t + 1000);
    const domain = { name: 'SysCommander Leaderboard', version: '1', chainId: (await ethers.provider.getNetwork()).chainId, verifyingContract: await board.getAddress() };
    const types = { Score: [{ name: 'player', type: 'address' }, { name: 'season', type: 'uint32' }, { name: 'score', type: 'uint32' }, { name: 'seconds', type: 'uint32' }, { name: 'runHash', type: 'bytes32' }] };
    const runHash = ethers.keccak256(ethers.toUtf8Bytes('x'));
    const sig = await referee.signTypedData(domain, types, { player: alice.address, season: 7, score: 4242, seconds: 99, runHash });
    // send the game's own calldata from the player's wallet
    await (await alice.sendTransaction({ to: await board.getAddress(), data: LB.encodeSubmit(7, 4242, 99, runHash, sig) })).wait();
    const raw = await ethers.provider.call({ to: await board.getAddress(), data: LB.encodeTop(7) });
    const top = LB.decodeTop(raw);
    expect(top.length).to.equal(1);
    expect(ethers.getAddress(top[0].player)).to.equal(alice.address);
    expect(top[0].score).to.equal(4242);
    expect(top[0].secs).to.equal(99);
  });
});
