// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title SysCommander leaderboard
/// @notice Keeps each player's best score per season and an on-chain top 10.
///         Scores are only accepted with a signature from the referee, which replays every
///         run through the real game code before signing (see leaderboard/referee).
contract SysCommanderLeaderboard is Ownable, EIP712 {
    struct Season {
        uint64 start;
        uint64 end;
    }

    struct Entry {
        address player;
        uint32 score;
        uint32 secs; // play time in seconds; lower wins a tie
        uint64 at;   // submission time; earlier wins a full tie
    }

    /// @dev Must match SCORE_TYPES in leaderboard/referee/src/index.js.
    bytes32 private constant SCORE_TYPEHASH =
        keccak256("Score(address player,uint32 season,uint32 score,uint32 seconds,bytes32 runHash)");
    uint256 public constant TOP_SIZE = 10;

    address public referee;
    mapping(uint32 => Season) public seasons;
    mapping(uint32 => mapping(address => Entry)) public best;
    mapping(bytes32 => bool) public usedRun;
    mapping(uint32 => Entry[]) private _top;

    event RefereeChanged(address indexed referee);
    event SeasonSet(uint32 indexed season, uint64 start, uint64 end);
    event ScoreSubmitted(uint32 indexed season, address indexed player, uint32 score, uint32 secs, bytes32 runHash, bool newBest);

    error SeasonNotOpen();
    error RunAlreadySubmitted();
    error NotSignedByReferee();

    constructor(address referee_) Ownable(msg.sender) EIP712("SysCommander Leaderboard", "1") {
        referee = referee_;
        emit RefereeChanged(referee_);
    }

    // ----- admin -----

    function setReferee(address referee_) external onlyOwner {
        referee = referee_;
        emit RefereeChanged(referee_);
    }

    function setSeason(uint32 season, uint64 start, uint64 end) external onlyOwner {
        require(end > start, "end before start");
        seasons[season] = Season(start, end);
        emit SeasonSet(season, start, end);
    }

    // ----- players -----

    /// @notice Record a verified score. Must be sent by the player the referee signed for.
    function submitScore(uint32 season, uint32 score, uint32 secs, bytes32 runHash, bytes calldata signature) external {
        Season memory s = seasons[season];
        if (s.end == 0 || block.timestamp < s.start || block.timestamp > s.end) revert SeasonNotOpen();
        if (usedRun[runHash]) revert RunAlreadySubmitted();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(SCORE_TYPEHASH, msg.sender, season, score, secs, runHash)));
        if (ECDSA.recover(digest, signature) != referee) revert NotSignedByReferee();
        usedRun[runHash] = true;

        Entry memory entry = Entry(msg.sender, score, secs, uint64(block.timestamp));
        Entry storage previous = best[season][msg.sender];
        bool newBest = previous.player == address(0) || _better(entry, previous);
        emit ScoreSubmitted(season, msg.sender, score, secs, runHash, newBest);
        if (!newBest) return;
        best[season][msg.sender] = entry;
        _insertTop(season, entry);
    }

    /// @notice The season's top list, best first.
    function top(uint32 season) external view returns (Entry[] memory) {
        return _top[season];
    }

    /// @notice The EIP-712 domain separator, for off-chain signers.
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ----- internals -----

    function _better(Entry memory a, Entry memory b) private pure returns (bool) {
        if (a.score != b.score) return a.score > b.score;
        return a.secs < b.secs; // equal score: faster wins; full tie: the earlier entry stays ahead
    }

    function _insertTop(uint32 season, Entry memory entry) private {
        Entry[] storage list = _top[season];
        // drop the player's previous entry, if any
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i].player == entry.player) {
                for (uint256 j = i; j + 1 < list.length; j++) list[j] = list[j + 1];
                list.pop();
                break;
            }
        }
        // find the slot, then shift the rest down
        uint256 pos = list.length;
        while (pos > 0 && _better(entry, list[pos - 1])) pos--;
        if (pos >= TOP_SIZE) return;
        if (list.length < TOP_SIZE) list.push(entry);
        for (uint256 k = list.length - 1; k > pos; k--) list[k] = list[k - 1];
        list[pos] = entry;
    }
}
