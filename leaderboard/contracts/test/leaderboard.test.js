// Contract tests on Hardhat's local chain, including the full path:
// bot plays a run -> referee Worker replays and signs it -> player submits it on chain.
const { expect } = require('chai');
const { ethers, network } = require('hardhat');
const artifact = require('../artifacts/SysCommanderLeaderboard.json');

const DOMAIN_NAME = 'SysCommander Leaderboard';
const TYPES = { Score: [
  { name: 'player', type: 'address' }, { name: 'season', type: 'uint32' }, { name: 'score', type: 'uint32' },
  { name: 'seconds', type: 'uint32' }, { name: 'runHash', type: 'bytes32' },
] };
const DAY = 86400;

async function now() { return (await ethers.provider.getBlock('latest')).timestamp; }

describe('SysCommanderLeaderboard', function () {
  this.timeout(120000);
  let owner, referee, alice, bob, others, board, domain;

  // sign like the referee Worker does
  const sign = (player, season, score, secs, runHash, signer = referee) =>
    signer.signTypedData(domain, TYPES, { player: player.address, season, score, seconds: secs, runHash });
  const hash = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));

  beforeEach(async () => {
    [owner, referee, alice, bob, ...others] = await ethers.getSigners();
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, owner);
    board = await factory.deploy(referee.address);
    await board.waitForDeployment();
    domain = { name: DOMAIN_NAME, version: '1', chainId: (await ethers.provider.getNetwork()).chainId, verifyingContract: await board.getAddress() };
    const t = await now();
    await board.setSeason(1, t - 10, t + 30 * DAY);
  });

  it('accepts a score signed by the referee and puts it in the top list', async () => {
    const sig = await sign(alice, 1, 5400, 300, hash('run-a'));
    await expect(board.connect(alice).submitScore(1, 5400, 300, hash('run-a'), sig))
      .to.emit(board, 'ScoreSubmitted').withArgs(1, alice.address, 5400, 300, hash('run-a'), true);
    const top = await board.top(1);
    expect(top.length).to.equal(1);
    expect(top[0].player).to.equal(alice.address);
    expect(top[0].score).to.equal(5400n);
  });

  it('rejects a signature from anyone but the referee', async () => {
    const sig = await sign(alice, 1, 99999, 10, hash('fake'), alice);
    await expect(board.connect(alice).submitScore(1, 99999, 10, hash('fake'), sig)).to.be.revertedWithCustomError(board, 'NotSignedByReferee');
  });

  it("rejects someone else's signed score, and any edited value", async () => {
    const sig = await sign(alice, 1, 5400, 300, hash('run-a'));
    await expect(board.connect(bob).submitScore(1, 5400, 300, hash('run-a'), sig)).to.be.revertedWithCustomError(board, 'NotSignedByReferee');
    await expect(board.connect(alice).submitScore(1, 5401, 300, hash('run-a'), sig)).to.be.revertedWithCustomError(board, 'NotSignedByReferee');
    await expect(board.connect(alice).submitScore(1, 5400, 299, hash('run-a'), sig)).to.be.revertedWithCustomError(board, 'NotSignedByReferee');
  });

  it('accepts a run only once', async () => {
    const sig = await sign(alice, 1, 5400, 300, hash('run-a'));
    await board.connect(alice).submitScore(1, 5400, 300, hash('run-a'), sig);
    await expect(board.connect(alice).submitScore(1, 5400, 300, hash('run-a'), sig)).to.be.revertedWithCustomError(board, 'RunAlreadySubmitted');
  });

  it('only accepts scores while the season is open', async () => {
    const sig2 = await sign(alice, 2, 100, 50, hash('s2'));
    await expect(board.connect(alice).submitScore(2, 100, 50, hash('s2'), sig2)).to.be.revertedWithCustomError(board, 'SeasonNotOpen');
    await network.provider.send('evm_increaseTime', [31 * DAY]);
    await network.provider.send('evm_mine');
    const sig = await sign(alice, 1, 100, 50, hash('late'));
    await expect(board.connect(alice).submitScore(1, 100, 50, hash('late'), sig)).to.be.revertedWithCustomError(board, 'SeasonNotOpen');
  });

  it('keeps only the best score per player; faster wins a tie', async () => {
    const go = async (score, secs, id) => board.connect(alice).submitScore(1, score, secs, hash(id), await sign(alice, 1, score, secs, hash(id)));
    await go(5000, 400, 'a1');
    await expect(go(4000, 100, 'a2')).to.emit(board, 'ScoreSubmitted').withArgs(1, alice.address, 4000, 100, hash('a2'), false);
    expect((await board.best(1, alice.address)).score).to.equal(5000n);
    await go(5000, 350, 'a3');
    expect((await board.best(1, alice.address)).secs).to.equal(350n);
    expect((await board.top(1)).length).to.equal(1);
  });

  it('keeps a sorted top 10', async () => {
    const players = [alice, bob, ...others].slice(0, 13);
    const scores = [300, 900, 100, 700, 700, 500, 1200, 50, 800, 650, 1000, 20, 400];
    for (let i = 0; i < players.length; i++) {
      const secs = i === 4 ? 90 : 100; // player 4 ties player 3 on score but is faster
      const id = hash('p' + i);
      await board.connect(players[i]).submitScore(1, scores[i], secs, id, await sign(players[i], 1, scores[i], secs, id));
    }
    const top = await board.top(1);
    expect(top.length).to.equal(10);
    expect(top.map((e) => Number(e.score))).to.deep.equal([1200, 1000, 900, 800, 700, 700, 650, 500, 400, 300]);
    expect(top[4].player).to.equal(players[4].address);
    // a player improving moves up without appearing twice
    const id = hash('p2-better');
    await board.connect(players[2]).submitScore(1, 1100, 100, id, await sign(players[2], 1, 1100, 100, id));
    const after = await board.top(1);
    expect(after.map((e) => Number(e.score))).to.deep.equal([1200, 1100, 1000, 900, 800, 700, 700, 650, 500, 400]);
    expect(after.filter((e) => e.player === players[2].address).length).to.equal(1);
  });

  it('only the owner can change the referee or seasons', async () => {
    await expect(board.connect(alice).setReferee(alice.address)).to.be.revertedWithCustomError(board, 'OwnableUnauthorizedAccount');
    await expect(board.connect(alice).setSeason(5, 1, 2)).to.be.revertedWithCustomError(board, 'OwnableUnauthorizedAccount');
  });

  it('end to end: a real run, verified and signed by the referee Worker, lands on chain', async () => {
    const { default: worker } = await import('../../referee/src/index.js');
    const { createGame } = await import('../../referee/src/game-factory.js');
    // play a real run with a bot until game over
    let run;
    for (let seed = 1; seed < 50 && !run; seed++) {
      const S = createGame(); S.newGame(0, seed);
      let a = seed;
      const r = () => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) >>> 8) / 16777216;
      for (let f = 0; f < 60000 && !['gameover', 'victory'].includes(S.G.state); f++) {
        if (f % 20 === 0) { S.keys.right = r() < 0.85; S.keys.jump = r() < 0.5; }
        if (r() < 0.08) S.pressed.jump = true;
        if (r() < 0.05) S.pressed.fire = true;
        if (S.G.state !== 'play' && f % 30 === 0) S.pressed.start = true;
        S.update();
      }
      if (S.runSummary().score > 0) run = S.runSummary();
    }
    // the referee holds the key; here we use the test referee's key
    const refereeKey = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // hardhat account #1
    expect(new ethers.Wallet(refereeKey).address).to.equal(referee.address);
    const env = { REFEREE_KEY: refereeKey, CHAIN_ID: String(domain.chainId), CONTRACT: domain.verifyingContract, SEASON: '1', ALLOWED_ORIGINS: '*' };
    const res = await worker.fetch(new Request('https://ref.test/verify', { method: 'POST', body: JSON.stringify({ player: alice.address, run }) }), env);
    const body = await res.json();
    expect(res.status, JSON.stringify(body.problems)).to.equal(200);
    await expect(board.connect(alice).submitScore(body.season, body.score, body.seconds, body.runHash, body.signature))
      .to.emit(board, 'ScoreSubmitted');
    const top = await board.top(1);
    expect(top[0].player).to.equal(alice.address);
    expect(top[0].score).to.equal(BigInt(run.score));
  });
});
