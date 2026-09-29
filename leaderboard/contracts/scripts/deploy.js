// Deploys the leaderboard contract and opens a first season.
//
//   DEPLOYER_KEY=0x...  REFEREE_ADDRESS=0x...  npm run deploy
//
// Optional: RPC_URL (default: zkSYS testnet), SEASON (default 1), SEASON_DAYS (default 30).
// Requires the EVM bytecode interpreter to be enabled on the target ZK Stack chain; without it,
// compile and deploy with zksolc / hardhat-zksync instead.
'use strict';
const { ethers } = require('ethers');
const artifact = require('../artifacts/SysCommanderLeaderboard.json');

async function main() {
  const rpc = process.env.RPC_URL || 'https://rpc-test-zk.syscoin.org/';
  const key = process.env.DEPLOYER_KEY;
  const referee = process.env.REFEREE_ADDRESS;
  if (!key || !referee || !ethers.isAddress(referee)) throw new Error('set DEPLOYER_KEY and REFEREE_ADDRESS');
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(key, provider);
  const { chainId } = await provider.getNetwork();
  console.log(`chain ${chainId}, deployer ${wallet.address}, balance ${ethers.formatEther(await provider.getBalance(wallet.address))}`);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const board = await factory.deploy(referee);
  await board.waitForDeployment();
  const address = await board.getAddress();
  console.log(`SysCommanderLeaderboard deployed at ${address}`);

  const season = Number(process.env.SEASON || 1);
  const days = Number(process.env.SEASON_DAYS || 30);
  const start = Math.floor(Date.now() / 1000);
  await (await board.setSeason(season, start, start + days * 86400)).wait();
  console.log(`season ${season} open until ${new Date((start + days * 86400) * 1000).toISOString()}`);
  console.log(`\nNext: put CONTRACT = "${address}" and SEASON = "${season}" in leaderboard/referee/wrangler.toml`);
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
