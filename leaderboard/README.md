# SysCommander leaderboard (zkSYS)

An optional on-chain leaderboard. Playing never needs a wallet; players who want to can put a
verified score on the zkSYS chain, and each season keeps a transparent top 10 (for competitions
and rewards).

## How it fits together

```
 game (browser)                     referee (Cloudflare Worker)              contract (zkSYS)
 ──────────────                     ───────────────────────────              ────────────────
 plays a run, records input  ──►   POST /verify {player, run}
                                    replays the run with the real game code
                                    checks score, time, rules
                             ◄──   signs {player, season, score, seconds, runHash}  (EIP-712)
 player's wallet sends  ───────────────────────────────────────────────────►  submitScore(...)
                                                                              checks the referee's
                                                                              signature, keeps the
                                                                              best score + top 10
```

- The **game** records each run's input frame by frame and is fully deterministic
  (`SysCommander.runSummary()` in `js/game.js`).
- The **referee** (`referee/`) replays the run through the exact same game code, bundled by
  `scripts/build-game-factory.js`, and signs only runs that reproduce the claimed result. The rules:
  the run starts in Era I, cheat mode was never used, the game was not continued after a game
  over, and the run has ended.
- The **contract** (`contracts/`) accepts a score only with the referee's signature, only from
  the wallet it was signed for, and each run only once. It stores each player's best score per
  season and a sorted top 10 (higher score first, then faster time, then earlier submission).
- Player names come from the wallet address (`js/names.js`), e.g. "Turbo Pogo Whale #3F2A".

## Tests

```sh
cd leaderboard/referee   && npm install && npm test   # Worker: signs real runs, refuses fakes
cd leaderboard/contracts && npm install && npm test   # contract + end-to-end on a local chain
```

The contract is compiled with solc-js (`scripts/compile.js`), and Hardhat only provides the
local test chain.

## Trying it locally

Run the whole stack on your machine, with no real chain or Cloudflare account:

```sh
cd leaderboard/contracts && npx hardhat node          # terminal 1: local chain (chain ID 31337)
cd leaderboard/contracts && RPC_URL=http://127.0.0.1:8545 \
  DEPLOYER_KEY=<hardhat account #0 key> REFEREE_ADDRESS=<hardhat account #1 address> npm run deploy
REFEREE_KEY=<hardhat account #1 key> CONTRACT=<deployed address> \
  node leaderboard/scripts/dev-referee.mjs            # terminal 2: referee on http://localhost:8787
python3 -m http.server 8080                           # terminal 3: the game
```

Then point `js/leaderboard-config.js` at `http://localhost:8787`, the contract and
`chain: { id: 31337, rpc: 'http://127.0.0.1:8545', ... }`, and add the Hardhat network to your
wallet. The Hardhat keys are public test keys: never use them anywhere else.

## Going live on zkSYS testnet

zkSYS testnet: RPC `https://rpc-test-zk.syscoin.org/`, chain ID `5701`, currency TSYS (faucet on
the zkSYS testnet site).

1. **Check the EVM interpreter.** zkSYS is a ZK Stack chain. `npm run deploy` deploys ordinary EVM
   bytecode, which only works if the chain has the EVM bytecode interpreter enabled. If it
   doesn't, the same Solidity must be compiled with `zksolc` and deployed with `hardhat-zksync`.
2. **Create two wallets:** a *deployer* (owns the contract and opens seasons) and a *referee*
   (only signs scores; its key lives in Cloudflare). Fund the deployer with test TSYS. The
   referee needs no funds.
3. **Deploy the contract** and open season 1:
   ```sh
   cd leaderboard/contracts
   DEPLOYER_KEY=0x... REFEREE_ADDRESS=0x... npm run deploy
   ```
4. **Deploy the referee Worker.** This needs the Cloudflare **Workers Paid** plan: replaying a
   full run takes up to about 1 s of CPU, and the free plan allows 10 ms.
   ```sh
   cd leaderboard/referee
   # put the contract address and season in wrangler.toml, then:
   npx wrangler secret put REFEREE_KEY      # paste the referee's private key
   npm run deploy
   ```
5. **Connect the game.** Fill in `js/leaderboard-config.js` with the Worker URL and the contract
   address. While `contract` is empty the leaderboard stays hidden, so this file is the on/off
   switch. Once it's filled in, players see:
   - a **SCOREBOARD** button on the title screen, which shows the season's top 10 with names
     derived from the addresses. Reading it needs no wallet.
   - after a game over or the victory screen, a **RECORD MY SCORE** panel. It connects Pali or
     MetaMask (adding or switching to the zkSYS network if needed), has the referee verify the run,
     and sends `submitScore`. Runs that can't count (cheat mode, continued, not started in Era I)
     show why instead.
6. For every new season, call `setSeason(id, start, end)` from the deployer, and update `SEASON`
   in `wrangler.toml`.

Never commit private keys. The referee key only lives as a Cloudflare secret.

## After zkSYS mainnet

Deploy the same contract to mainnet (`RPC_URL=...`), set `CHAIN_ID` and `CONTRACT` in
`wrangler.toml`, and update the chain and contract in `js/leaderboard-config.js`. Nothing else
changes.
