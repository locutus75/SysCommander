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
5. For every new season, call `setSeason(id, start, end)` from the deployer, and update `SEASON`
   in `wrangler.toml`.

Never commit private keys. The referee key only lives as a Cloudflare secret.

## After zkSYS mainnet

Deploy the same contract to mainnet (`RPC_URL=...`), and set `CHAIN_ID` and `CONTRACT` in
`wrangler.toml`. Nothing else changes.
