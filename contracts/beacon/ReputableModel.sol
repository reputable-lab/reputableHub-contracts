// SPDX-FileCopyrightText: 2024 REPUTABLE <contact@reputable.network>
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IReputableModel, ModelWeights} from "./IReputableModel.sol";

/**
 * @title Implementation of the Reputable contract.
 * Note:
 *  - This contract and the Beacon are deployed using "Upgrades" plugin of OZ.
 */
contract ReputableModel is IReputableModel, Initializable, OwnableUpgradeable {
    // keccak256(abi.encode(uint256(keccak256("reputable.storage.ReputableModel")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant REPUTABLE_MODEL_STORAGE_LOCATION =
        0xa3aed100e50b8a6f205b07f554e4d89e2ea86b51f60a75e6bb2f992d1184ed00;

    /// @custom:storage-location erc7201:reputable.storage.ReputableModel
    struct ReputableModelStorage {
        string _reputableModelName;
        ModelWeights _weights;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(string calldata args, address initialOwner, ModelWeights calldata weights) public initializer {
        if (!_validateWeights(weights)) {
            revert WeightsSumExceedsLimit();
        }

        ReputableModelStorage storage $ = _getReputableModelStorage();
        __Ownable_init(initialOwner);
        $._reputableModelName = args;
        $._weights = weights;
    }

    function updateReputableModel(ModelWeights calldata weights) public onlyOwner {
        ReputableModelStorage storage $ = _getReputableModelStorage();

        if (!_validateWeights(weights)) {
            revert WeightsSumExceedsLimit();
        }

        $._weights = weights;
        emit ReputableModelUpdated();
    }

    function getReputableModelWeights() public view returns (ModelWeights memory) {
        ReputableModelStorage storage $ = _getReputableModelStorage();
        return $._weights;
    }

    function _validateWeights(ModelWeights memory weights) private pure returns (bool) {
        return
            (weights.commitWeight +
                weights.nbOfContributorWeight +
                weights.contributionRecencyWeight +
                weights.txWeight +
                weights.uniqueFromWeight +
                weights.tveWeight) <= 100;
    }

    function _getReputableModelStorage() private pure returns (ReputableModelStorage storage $) {
        assembly ("memory-safe") {
            $.slot := REPUTABLE_MODEL_STORAGE_LOCATION
        }
    }
}
