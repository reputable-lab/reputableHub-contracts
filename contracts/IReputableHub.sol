// SPDX-FileCopyrightText: 2024 REPUTABLE <contact@reputable.network>
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ModelWeights} from "./beacon/IReputableModel.sol";

interface IReputableHub {
    struct AttestationValues {
        uint16 commitsCount; // Nombre brut de commits
        uint16 commitProportion; // Valeur déjà normalisée
        uint16 normalizedContributors; // Valeur déjà normalisée
        uint16 contributionRecency; // Valeur déjà normalisée
        uint16 normalizedTx; // Valeur déjà normalisée
        uint16 normalizedUniqueFrom; // Valeur déjà normalisée
        uint16 normalizedTve; // Valeur déjà normalisée
    }

    struct OffChainAttestationInput {
        string offchainAttestationId;
        bytes data;
        address attester;
        bytes signature;
    }

    // ################# CustomErrors ###################
    error InvalidAdminAddress(address defaultAdmin);
    error InvalidReputableModel(address reputableModel);
    error InvalidAttestation();
    error IncompatibleVectorLengths(uint256 reputableModelVector);
    error WeightsSumExceedsLimit();
    error InvalidVectorSize();

    // ################# Events ######################
    event NewReputableModel(string args, address reputableModel);

    // ################# Functions ###################
    function createReputableModel(
        string memory args,
        address owner,
        ModelWeights calldata reputableModelWeights
    ) external returns (address reputableModelAddress);

    function predictReputableModel(string memory _args, address owner) external view returns (address);

    function proveReputableScore(
        OffChainAttestationInput calldata attestation,
        address reputableModel
    ) external view returns (uint256 reputableScore);
}
