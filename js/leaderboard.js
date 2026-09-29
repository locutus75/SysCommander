'use strict';
// Optional zkSYS leaderboard: record a verified score with your wallet, and view the season top 10.
// Hidden unless js/leaderboard-config.js has a contract address. No libraries: the three contract
// calls it needs are ABI-encoded by hand (checked against the real ABI by
// leaderboard/contracts/test/abi.test.js).
const Leaderboard = (() => {
  const cfg = window.SYSCOMMANDER_LEADERBOARD || {};
  const enabled = /^0x[0-9a-fA-F]{40}$/.test(cfg.contract || '') && !!cfg.refereeUrl;

  // ---------- ABI ----------
  const SELECTOR = {
    submitScore: '0xaef63350', // submitScore(uint32,uint32,uint32,bytes32,bytes)
    top: '0x1f290c3f',         // top(uint32)
  };
  const strip = (h) => String(h).replace(/^0x/, '');
  const word = (hex) => strip(hex).padStart(64, '0');
  const uint = (n) => word(BigInt(n).toString(16));
  function encodeSubmit(season, score, secs, runHash, signature) {
    const sig = strip(signature);
    const body = sig.padEnd(Math.ceil(sig.length / 64) * 64, '0');
    return SELECTOR.submitScore + uint(season) + uint(score) + uint(secs) + word(runHash) + uint(5 * 32) + uint(sig.length / 2) + body;
  }
  const encodeTop = (season) => SELECTOR.top + uint(season);
  function decodeTop(hex) {
    const d = strip(hex);
    if (!d) return [];
    const w = (i) => d.slice(i * 64, (i + 1) * 64);
    const start = parseInt(w(0), 16) / 32;
    const n = parseInt(w(start), 16);
    const list = [];
    for (let i = 0; i < n; i++) {
      const b = start + 1 + i * 4;
      list.push({ player: '0x' + w(b).slice(24), score: parseInt(w(b + 1), 16), secs: parseInt(w(b + 2), 16), at: parseInt(w(b + 3), 16) });
    }
    return list;
  }

  // ---------- chain + referee ----------
  async function rpc(method, params) {
    const res = await fetch(cfg.chain.rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    const j = await res.json();
    if (j.error) throw new Error(j.error.message || 'RPC error');
    return j.result;
  }
  let seasonCache = null;
  async function season() {
    if (seasonCache == null) {
      const h = await (await fetch(cfg.refereeUrl + '/health')).json();
      seasonCache = Number(h.season);
    }
    return seasonCache;
  }
  const readTop = async () => decodeTop(await rpc('eth_call', [{ to: cfg.contract, data: encodeTop(await season()) }, 'latest']));

  // ---------- wallet ----------
  const eth = () => window.ethereum;
  async function connect() {
    if (!eth()) throw new Error('No wallet found. Install Pali Wallet or MetaMask to record your score.');
    const [account] = await eth().request({ method: 'eth_requestAccounts' });
    const want = '0x' + Number(cfg.chain.id).toString(16);
    const current = await eth().request({ method: 'eth_chainId' });
    if (String(current).toLowerCase() !== want) {
      try {
        await eth().request({ method: 'wallet_switchEthereumChain', params: [{ chainId: want }] });
      } catch (e) {
        if (e && (e.code === 4902 || /unrecognized|not added|unknown chain/i.test(e.message || ''))) {
          await eth().request({ method: 'wallet_addEthereumChain', params: [{
            chainId: want, chainName: cfg.chain.name, rpcUrls: [cfg.chain.rpc], nativeCurrency: cfg.chain.currency,
            blockExplorerUrls: cfg.chain.explorer ? [cfg.chain.explorer] : undefined,
          }] });
        } else throw e;
      }
    }
    return account;
  }
  async function waitForReceipt(hash) {
    for (let i = 0; i < 120; i++) {
      const r = await eth().request({ method: 'eth_getTransactionReceipt', params: [hash] });
      if (r) return r;
      await new Promise((ok) => setTimeout(ok, 1500));
    }
    throw new Error('Still waiting for the transaction; check your wallet later.');
  }
  function friendly(e) {
    const msg = (e && (e.message || e.reason)) || String(e);
    if (e && e.code === 4001) return 'Cancelled in your wallet.';
    if (/insufficient funds/i.test(msg)) return `Not enough ${cfg.chain.currency.symbol} for the transaction fee. Get some from the zkSYS faucet.`;
    // custom errors of the contract, by name or by their 4-byte selector in the revert data
    if (/SeasonNotOpen|0x9ac969be/i.test(msg)) return 'The current season is closed.';
    if (/RunAlreadySubmitted|0xc2abb874/i.test(msg)) return 'This run has already been recorded.';
    if (/NotSignedByReferee|0xa286c656/i.test(msg)) return 'The contract did not accept the referee signature (wrong wallet or season?).';
    return msg.length > 160 ? msg.slice(0, 160) + '...' : msg;
  }

  // ---------- UI ----------
  const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nameTag = (addr) => `<span class="lb-name" style="color:${SysNames.colorFromAddress(addr)}">${esc(SysNames.nameFromAddress(addr))}</span>`;

  let lastRun = null, busy = false, recorded = false, root = null;
  const PANELS = `
    <button id="lb-open" type="button">SCOREBOARD</button>
    <div id="lb-record" class="lb-panel" hidden>
      <div class="lb-title">ZKSYS LEADERBOARD</div>
      <div id="lb-record-body"></div>
      <div class="lb-row"><button id="lb-submit" type="button">RECORD MY SCORE</button><button id="lb-view" type="button">SCOREBOARD</button></div>
      <div id="lb-status" class="lb-status" aria-live="polite"></div>
    </div>
    <div id="lb-board" class="lb-panel" hidden>
      <div class="lb-title">TOP 10 - SEASON <span id="lb-season">?</span></div>
      <ol id="lb-list"></ol>
      <div id="lb-board-status" class="lb-status"></div>
      <div class="lb-row"><button id="lb-close" type="button">CLOSE</button></div>
    </div>`;
  const $ = (id) => root.querySelector('#' + id);

  function eligibility(run) {
    if (!run) return 'Play a run first.';
    if (run.cheated) return 'Cheat mode was used, so this run cannot be recorded.';
    if (run.continued) return 'Continued runs cannot be recorded. Start a new game from Era I.';
    if (run.startLevel !== 1) return 'Only runs that start in Era I can be recorded.';
    if (!run.score) return 'Score some points first!';
    return null;
  }
  function showRecord() {
    const why = eligibility(lastRun);
    $('lb-record-body').innerHTML = lastRun
      ? `<div class="lb-big">${lastRun.score} POINTS</div><div>TIME ${clock(lastRun.seconds)} - ERAS CLEARED ${lastRun.levels.length}</div>`
      : '';
    $('lb-submit').hidden = !!why || recorded;
    $('lb-status').textContent = why && lastRun ? why : (recorded ? 'Recorded on zkSYS!' : 'Put this score on the zkSYS chain? A wallet is needed, but the game never requires one.');
    $('lb-record').hidden = false;
  }
  async function submit() {
    if (busy || !lastRun) return;
    busy = true;
    const status = (t) => { $('lb-status').innerHTML = t; };
    try {
      status('Connecting your wallet...');
      const player = await connect();
      status(`Playing as ${nameTag(player)}.<br>The referee is checking your run...`);
      const res = await fetch(cfg.refereeUrl + '/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ player, run: lastRun }) });
      const v = await res.json();
      if (!v.ok) throw new Error('The referee did not accept this run: ' + (v.problems || []).join('; '));
      status('Run verified! Confirm the transaction in your wallet...');
      const hash = await eth().request({ method: 'eth_sendTransaction', params: [{ from: player, to: cfg.contract, data: encodeSubmit(v.season, v.score, v.seconds, v.runHash, v.signature) }] });
      status('Waiting for zkSYS to confirm...');
      const receipt = await waitForReceipt(hash);
      if (receipt.status !== '0x1' && receipt.status !== 1) throw new Error('The transaction failed.');
      recorded = true;
      $('lb-submit').hidden = true;
      const top = await readTop().catch(() => []);
      const rank = top.findIndex((e) => e.player.toLowerCase() === player.toLowerCase());
      const link = cfg.chain.explorer ? ` <a href="${esc(cfg.chain.explorer.replace(/\/$/, ''))}/tx/${esc(hash)}" target="_blank" rel="noopener">View transaction</a>` : '';
      status(`Recorded on zkSYS as ${nameTag(player)}!${rank >= 0 ? ` You are #${rank + 1} this season.` : ''}${link}`);
    } catch (e) {
      status(esc(friendly(e)));
    } finally {
      busy = false;
    }
  }
  async function showBoard() {
    $('lb-board').hidden = false;
    $('lb-list').innerHTML = '';
    $('lb-board-status').textContent = 'Loading from zkSYS...';
    try {
      $('lb-season').textContent = await season();
      const top = await readTop();
      $('lb-list').innerHTML = top.map((e, i) => `<li><span class="lb-rank">${i + 1}.</span>${nameTag(e.player)}<span class="lb-score">${e.score}</span><span class="lb-time">${clock(e.secs)}</span></li>`).join('');
      $('lb-board-status').textContent = top.length ? '' : 'No scores yet this season. Be the first!';
    } catch (e) {
      $('lb-board-status').textContent = 'Could not load the scoreboard: ' + friendly(e);
    }
  }

  if (enabled) {
    root = document.createElement('div');
    root.id = 'lb';
    root.innerHTML = PANELS;
    document.body.appendChild(root);
    const stop = (e) => e.stopPropagation(); // keep clicks and keys inside the panels away from the game
    root.addEventListener('keydown', stop);
    $('lb-open').addEventListener('click', showBoard);
    $('lb-view').addEventListener('click', showBoard);
    $('lb-close').addEventListener('click', () => { $('lb-board').hidden = true; });
    $('lb-submit').addEventListener('click', submit);
    window.addEventListener('syscommander:runend', (e) => { lastRun = e.detail; recorded = false; });
    // show the right panels for the current screen
    setInterval(() => {
      const state = window.SysCommander && window.SysCommander.G.state;
      $('lb-open').hidden = state !== 'title';
      const end = state === 'gameover' || state === 'victory';
      if (end && $('lb-record').hidden && lastRun) showRecord();
      if (!end) $('lb-record').hidden = true;
      if (state === 'play' || state === 'intro') $('lb-board').hidden = true;
    }, 200);
  }

  return { enabled, encodeSubmit, encodeTop, decodeTop, SELECTOR };
})();
