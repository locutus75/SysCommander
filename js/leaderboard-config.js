// Settings for the optional zkSYS leaderboard. While `contract` is empty the leaderboard is
// hidden and the game works exactly as before. Fill these in after deploying
// (see leaderboard/README.md).
window.SYSCOMMANDER_LEADERBOARD = Object.assign({
  // URL of the referee Cloudflare Worker, without a trailing slash
  refereeUrl: '',
  // address of the SysCommanderLeaderboard contract
  contract: '',
  chain: {
    id: 5701,
    name: 'zkSYS Testnet',
    rpc: 'https://rpc-test-zk.syscoin.org/',
    currency: { name: 'Test SYS', symbol: 'TSYS', decimals: 18 },
    explorer: '', // block explorer URL, if known (used for transaction links)
  },
}, window.SYSCOMMANDER_LEADERBOARD || {});
