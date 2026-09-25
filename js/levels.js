'use strict';
/*
 * Level data. Each map is built with a tiny builder so levels are easy to tweak.
 *
 * Tile legend
 *   .  empty            #  ground            ~  ice (slippery)     =  one-way platform
 *   G  green candle     R  red candle        ^  spikes             D  force-field gate
 *   o  SYS coin         b  BTC orb           a  Z-DAG ammo         k  keygem
 *   1  extra life       p  pogo stick        L  chainlock          C  checkpoint (Sentry Node)
 *   !  info sign        E  exit door         P  player start
 * Spawns (removed from the map on load)
 *   r  rug puller       f  FUD ghost         B  bear market        g  gas guzzler
 *   w  whale            X  51% attacker      M  vertical candle platform
 *   N  horizontal platform
 */
const LEVELS = (() => {
  const H = 16;

  function build(W, fn) {
    const g = Array.from({ length: H }, () => Array(W).fill('.'));
    const set = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
    const rect = (x1, y1, x2, y2, c = '#') => {
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) set(x, y, c);
    };
    fn({
      set,
      rect,
      ground: (x1, x2, top = 13, c = '#') => rect(x1, top, x2, H - 1, c),
      plat: (x1, x2, y) => rect(x1, y, x2, y, '='),
      row: (x1, x2, y, c) => rect(x1, y, x2, y, c),
      // A wall with a force field in it; needs a keygem to pass.
      gate: (x, top = 9, floor = 13) => { rect(x, 0, x, top - 1, '#'); rect(x, top, x, floor - 1, 'D'); },
    });
    return g.map((r) => r.join(''));
  }

  return [
    {
      theme: 'genesis',
      era: 'ERA I - 2014',
      title: 'GENESIS BLOCK',
      story: 'Syscoin is born! Merge-mined with Bitcoin, the new chain borrows the hashpower of the biggest network on Earth. But scammers and FUD ghosts want to bury the newcomer. Find the Pogo Stick and reach the exit.',
      threats: ['r', 'f'],
      signs: [
        'Welcome, SysCommander! Move with ARROWS, jump with Z or SPACE, blast with X. Grab the blue SYS coins!',
        'Syscoin is merge-mined with Bitcoin: miners secure both chains at once. Orange orbs are worth 500!',
        'The flags are Sentry Nodes. Touch one and it remembers your spot.',
        'A POGO STICK! Press C to hop on. Hold JUMP while bouncing to go extra high.',
        'Keygems open force fields. Some things are worth HODLing.',
        '2018 is around the corner... and it is going to get weird.',
      ],
      map: build(150, (b) => {
        b.ground(0, 24);
        b.set(2, 12, 'P'); b.set(5, 12, '!');
        b.row(8, 11, 11, 'o');
        b.plat(13, 16, 11); b.row(13, 16, 10, 'o');
        b.set(20, 12, 'r');
        b.ground(28, 46);
        b.rect(32, 11, 33, 12);
        b.rect(36, 9, 37, 12);
        b.set(36, 6, 'b'); b.set(37, 7, 'o');
        b.set(41, 8, 'f');
        b.set(43, 12, '!'); b.set(45, 12, '!');
        b.set(46, 12, 'C');
        b.ground(50, 72);
        b.set(53, 12, '!'); b.set(55, 12, 'p');
        b.rect(60, 9, 61, 12);
        b.row(60, 61, 7, 'o');
        b.row(64, 65, 12, '^');
        b.set(68, 12, 'a'); b.set(71, 12, 'r');
        b.ground(76, 110);
        b.set(78, 12, '!');
        b.plat(80, 82, 11); b.plat(84, 86, 9); b.plat(88, 90, 7);
        b.set(81, 10, 'o'); b.set(85, 8, 'o'); b.set(89, 6, 'k');
        b.set(93, 6, 'f');
        b.gate(96);
        b.row(99, 102, 11, 'o');
        b.set(101, 12, 'r'); b.set(106, 12, 'r');
        b.set(108, 12, 'C');
        b.ground(114, 149);
        b.plat(118, 121, 11); b.set(119, 10, '1'); b.set(120, 10, 'o'); b.set(118, 10, 'o');
        b.set(125, 8, 'b');
        b.set(128, 7, 'f');
        b.row(131, 132, 12, '^');
        b.set(136, 12, 'r');
        b.row(138, 142, 10, 'o');
        b.set(143, 12, '!');
        b.set(146, 12, 'E');
      }),
    },
    {
      theme: 'exchange',
      era: 'ERA II - 2018',
      title: 'THE FLASH CRASH',
      story: 'Exchange chaos! One summer day the order books went haywire and SYS briefly traded at an absurd 96 BTC. Ride the moving price candles, dodge the whales dumping from above, and keep your cool.',
      threats: ['r', 'f', 'w'],
      signs: [
        'July 2018. The order books are going crazy. Those price candles move - ride them!',
        'For a few wild minutes SYS traded at 96 BTC on a major exchange. Nobody saw that one coming.',
        'Whales dump red candles from above. Stay nimble, Commander!',
        'Trading was halted and the trades rolled back. Lesson: keep calm and keep building.',
        'The market cools down... and winter is coming.',
      ],
      map: build(160, (b) => {
        b.ground(0, 20);
        b.set(2, 12, 'P'); b.set(4, 12, '!');
        b.row(7, 10, 11, 'o');
        b.set(14, 12, 'r');
        b.set(23, 11, 'M'); b.set(29, 10, 'M');
        b.set(24, 6, 'o'); b.set(30, 5, 'o');
        b.ground(35, 58);
        b.set(37, 12, '!'); b.set(39, 12, 'a');
        b.rect(44, 11, 45, 12, 'G'); b.rect(47, 9, 48, 12, 'G'); b.rect(50, 7, 51, 12, 'G');
        b.set(50, 5, 'b'); b.set(51, 5, 'o');
        b.rect(53, 10, 54, 12, 'R');
        b.set(42, 3, 'w');
        b.set(57, 12, 'C');
        b.ground(62, 95);
        b.set(64, 12, '!');
        b.set(67, 8, 'f'); b.set(70, 12, 'r');
        b.rect(76, 9, 77, 12, 'G'); b.set(77, 8, 'k'); b.set(76, 8, 'o');
        b.set(74, 5, 'f'); b.set(82, 12, 'r'); b.set(85, 3, 'w');
        b.row(86, 89, 11, 'o');
        b.gate(92);
        b.set(94, 12, 'a');
        b.set(98, 11, 'M'); b.set(103, 9, 'M'); b.set(107, 11, 'M');
        b.set(104, 5, 'b');
        b.ground(111, 159);
        b.set(113, 12, '!'); b.set(115, 12, 'C');
        b.row(119, 120, 12, '^');
        b.set(124, 12, 'r'); b.set(130, 3, 'w'); b.set(128, 8, 'f');
        b.rect(134, 11, 136, 12, 'G'); b.rect(138, 9, 140, 12, 'G'); b.set(139, 8, '1');
        b.rect(142, 11, 143, 12, 'R');
        b.row(145, 149, 10, 'o');
        b.set(146, 12, 'r'); b.set(149, 12, 'r');
        b.set(152, 12, '!'); b.set(156, 12, 'E');
      }),
    },
    {
      theme: 'winter',
      era: 'ERA III - 2018/19',
      title: 'CRYPTO WINTER',
      story: 'Prices froze solid and the bears came out of hiding. Many projects gave up - but the Syscoin builders kept building. Mind the slippery ice and do not let the Bear Market catch you!',
      threats: ['B', 'f'],
      signs: [
        'Crypto winter. Prices froze and the bears came out. Ice is slippery - mind your step!',
        'While the price slept, the builders kept building: Z-DAG brought near-instant payments.',
        'Next: a trustless bridge between SYS and Ethereum. Bears hate this one trick.',
        'Spring is coming. So are the gas fees...',
      ],
      map: build(160, (b) => {
        b.ground(0, 30);
        b.set(2, 12, 'P'); b.set(4, 12, '!');
        b.row(8, 12, 11, 'o');
        b.plat(20, 23, 11); b.row(20, 23, 10, 'o');
        b.set(18, 12, 'B'); b.set(26, 12, 'a');
        b.ground(31, 50, 13, '~');
        b.row(36, 40, 11, 'o');
        b.set(44, 12, 'B');
        b.ground(54, 80);
        b.set(56, 12, '!');
        b.rect(58, 11, 60, 12, '~'); b.rect(62, 9, 64, 12, '~'); b.set(63, 8, 'k');
        b.set(68, 7, 'f'); b.set(74, 12, 'B'); b.set(78, 12, 'C');
        b.ground(84, 125);
        b.row(90, 91, 12, '^');
        b.plat(95, 98, 11); b.plat(102, 105, 9);
        b.set(96, 10, 'b'); b.set(103, 8, 'b'); b.set(104, 8, 'o');
        b.set(100, 12, 'B'); b.set(110, 12, 'B'); b.set(107, 5, 'f');
        b.set(112, 12, 'a');
        b.set(114, 12, '!'); b.gate(116); b.set(119, 12, 'C');
        b.ground(129, 140, 13, '~'); b.ground(141, 159);
        b.set(133, 12, 'B'); b.plat(136, 139, 11); b.set(138, 10, '1'); b.set(137, 10, 'o');
        b.set(145, 7, 'f');
        b.row(146, 148, 11, 'o');
        b.set(150, 12, '!'); b.set(156, 12, 'E');
      }),
    },
    {
      theme: 'gas',
      era: 'ERA IV - 2021',
      title: 'THE GAS WARS',
      story: 'DeFi mania! Gas fees on Ethereum explode and gas guzzlers roam the land. Syscoin answers with the NEVM: EVM smart contracts on a chain merge-mined with Bitcoin. Fight your way to it!',
      threats: ['g', 'r', 'f'],
      signs: [
        '2021. Gas fees are through the roof! Gas guzzlers hop at you - blast them before they land.',
        'Why pay $100 for one swap? The NEVM brings EVM smart contracts to a Bitcoin merge-mined chain.',
        'NEVM is live! But someone is gathering hashpower for a 51% attack...',
      ],
      map: build(170, (b) => {
        b.ground(0, 25);
        b.set(2, 12, 'P'); b.set(4, 12, '!');
        b.row(8, 11, 11, 'o');
        b.set(15, 12, 'g'); b.set(21, 12, 'a');
        b.rect(26, 11, 40, 15);
        b.set(34, 10, 'g'); b.row(29, 32, 8, 'o');
        b.rect(41, 9, 50, 15);
        b.set(43, 8, '!'); b.set(47, 8, 'a'); b.row(44, 49, 6, 'o');
        b.ground(51, 70);
        b.row(55, 56, 12, '^');
        b.set(60, 7, 'f'); b.set(62, 12, 'g'); b.set(66, 12, 'g');
        b.set(69, 12, 'C');
        b.set(73, 11, 'N'); b.set(82, 10, 'N');
        b.row(78, 80, 7, 'o');
        b.ground(91, 130);
        b.rect(98, 10, 98, 12); b.rect(100, 6, 101, 12); b.set(101, 5, 'k'); b.set(100, 5, 'b');
        b.set(106, 12, 'g'); b.set(112, 12, 'r'); b.set(110, 6, 'f'); b.set(117, 12, 'g');
        b.set(121, 12, 'a');
        b.gate(124); b.set(127, 12, 'C');
        b.ground(134, 169);
        b.row(138, 139, 12, '^');
        b.set(142, 12, 'g'); b.set(147, 12, 'g');
        b.plat(148, 151, 11); b.set(149, 10, '1'); b.set(150, 10, 'b');
        b.set(155, 6, 'f');
        b.set(158, 12, 'r'); b.set(161, 12, '!'); b.set(166, 12, 'E');
      }),
    },
    {
      theme: 'siege',
      era: 'ERA V - FINALE',
      title: 'THE 51% SIEGE',
      story: 'A 51% Attacker has rented a mountain of hashpower and wants to rewrite history! Collect all four Chainlocks - finality signed by the Sentry Nodes - to break its shield, then blast it back to the mempool.',
      threats: ['X'],
      boss: true,
      exitAt: [41, 12],
      ammoSpots: [[3, 12], [40, 12], [22, 6], [7, 8]],
      signs: [
        'Grab all 4 Chainlocks to break the shield. Your blaster is useless until then!',
      ],
      map: build(44, (b) => {
        b.rect(0, 0, 0, 15); b.rect(43, 0, 43, 15); b.ground(0, 43);
        b.set(2, 12, 'P'); b.set(4, 12, '!');
        b.plat(10, 12, 11); b.plat(5, 9, 9);
        b.plat(31, 33, 11); b.plat(34, 38, 9);
        b.plat(14, 16, 9); b.plat(27, 29, 9); b.plat(17, 26, 7);
        b.set(6, 8, 'L'); b.set(37, 8, 'L'); b.set(21, 6, 'L'); b.set(40, 12, 'L');
        b.set(8, 8, 'a'); b.set(35, 8, 'a'); b.set(22, 12, 'a');
        b.set(21, 2, 'X');
      }),
    },
  ];
})();
