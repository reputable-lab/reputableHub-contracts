// SPDX-FileCopyrightText: 2024 REPUTABLE <contact@reputable.network>
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

struct ModelWeights {
    uint16 commitWeight;
    uint16 nbOfContributorWeight;
    uint16 contributionRecencyWeight;
    uint16 txWeight;
    uint16 uniqueFromWeight;
    uint16 tveWeight;
}

interface IReputableModel {
    // ################# CustomErrors ###################
    error WeightsSumExceedsLimit();

    // ################# Events ######################
    event ReputableModelUpdated();

    // ################# Functions ###################
    function initialize(string calldata args, address initialOwner, ModelWeights calldata weights) external;

    function updateReputableModel(ModelWeights calldata weights) external;

    function getReputableModelWeights() external view returns (ModelWeights memory);
}
