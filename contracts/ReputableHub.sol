// SPDX-FileCopyrightText: 2024 REPUTABLE <contact@reputable.network>
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ISP} from "@ethsign/sign-protocol-evm/src/interfaces/ISP.sol";
import {DataLocation} from "@ethsign/sign-protocol-evm/src/models/DataLocation.sol";
import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {IReputableHub} from "./IReputableHub.sol";
import {IReputableModel, ModelWeights} from "./beacon/IReputableModel.sol";
import {ReputableModelProxy} from "./beacon/ReputableModelProxy.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * This contract is the implementation contract
 * that will be used in the beacon Proxy Pattern
 */

contract ReputableHub is IReputableHub, ERC721Upgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 private constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 private constant ATTEST_OFFCHAIN_ACTION_NAME = "ATTEST_OFFCHAIN";

    // keccak256(abi.encode(uint256(keccak256("reputable.storage.ReputableHub")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant REPUTABLE_HUB_STORAGE_LOCATION =
        0xd7670ff7280f3cdbd77c2095176a1cb74cb6b3acee3307a9fd3f56e02dacf000;

    /// @custom:storage-location erc7201:reputable.storage.ReputableHub
    struct ReputableHubStorage {
        address _reputableModelBeacon;
        bytes32 _reputableModelCreationCodeHash;
        mapping(address reputableModelAddress => bool) _isReputableModel;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    ISP private _sp;

    function initialize(
        ISP sp,
        address reputableModelBeacon,
        address defaultAdmin,
        address upgrader
    ) external initializer {
        if (defaultAdmin == address(0)) revert InvalidAdminAddress(defaultAdmin);

        __ERC721_init("ReputableModel", "RM");
        __AccessControl_init();
        __UUPSUpgradeable_init();
        _sp = sp;

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(UPGRADER_ROLE, upgrader);
        ReputableHubStorage storage $ = _getReputableHubStorage();

        $._reputableModelBeacon = reputableModelBeacon;
        $._reputableModelCreationCodeHash = keccak256(
            abi.encodePacked(
                type(ReputableModelProxy).creationCode, // bytecode
                abi.encode($._reputableModelBeacon) // constructor args
            )
        );
    }

    /**
     * Create new reputable model and call initialize function.
     * The same owner can't have multiple reputationModel
     * with the same args. This is ensure by the Create2.
     * @return reputableModelAddress The address of the created reputable model contract.
     */
    function createReputableModel(
        string calldata args,
        address owner,
        ModelWeights calldata reputableModelWeight
    ) external returns (address reputableModelAddress) {
        ReputableHubStorage storage $ = _getReputableHubStorage();

        reputableModelAddress = address(
            new ReputableModelProxy{salt: _getCreate2Salt(args, owner)}($._reputableModelBeacon)
        );
        // Initialize the created proxy contract.
        // The proxy contract does a delegatecall to its implementation.
        // Re-Entrancy safe because the target contract is controlled.
        IReputableModel(reputableModelAddress).initialize(args, owner, reputableModelWeight);
        _mint(owner, uint256(uint160(reputableModelAddress)));
        $._isReputableModel[reputableModelAddress] = true;
        emit NewReputableModel(args, reputableModelAddress);
        return reputableModelAddress;
    }

    /**
     * Predict the address of the (created or not) ReputableModel for a given owner.
     * @param owner The owner of the reputableModel.
     */
    function predictReputableModel(string calldata _args, address owner) public view returns (address) {
        ReputableHubStorage storage $ = _getReputableHubStorage();
        return
            Create2.computeAddress(
                _getCreate2Salt(_args, owner), // salt
                $._reputableModelCreationCodeHash // bytecode hash
            );
    }

    /**@dev Calculates the reputable score based on Off-Chain protocol requirements.
     *
     * @param attestation The OffchainAttestation containing data to decode.
     * @param reputableModel Address of the reputable model contract.
     * @return reputableScore The calculated reputable score.
     *
     * Requirements:
     * - The `reputableModel` must be registered as a reputable model.
     * - The attestation data must be verified for authenticity.
     */
    function proveReputableScore(
        OffChainAttestationInput calldata attestation,
        address reputableModel
    ) public view returns (uint256 reputableScore) {
        ReputableHubStorage storage $ = _getReputableHubStorage();
        if (!$._isReputableModel[reputableModel]) revert InvalidReputableModel(reputableModel);
        // check if the attestation is correct
        bytes32 messageHash = keccak256(abi.encode(ATTEST_OFFCHAIN_ACTION_NAME, attestation.offchainAttestationId));
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        if (!SignatureChecker.isValidSignatureNow(attestation.attester, ethSignedMessageHash, attestation.signature)) {
            revert InvalidAttestation();
        }

        // Décoder les valeurs normalisées de l'attestation
        AttestationValues memory values = abi.decode(attestation.data, (AttestationValues));

        // Récupérer les poids du modèle
        ModelWeights memory weights = IReputableModel(reputableModel).getReputableModelWeights();

        // Applique le facteur de division selon le nombre de commits
        uint256 weightFactor = 1;
        if (values.commitsCount <= 10) {
            weightFactor = 10; // Divisé par 10
        } else if (values.commitsCount <= 30) {
            weightFactor = 2; // Divisé par 2
        }

        // Calculate score using adjusted weights and normalized values
        reputableScore = (((values.commitProportion * weights.commitWeight) +
            (values.normalizedContributors * weights.nbOfContributorWeight) +
            (values.contributionRecency * weights.contributionRecencyWeight) +
            (values.normalizedTx * weights.txWeight) +
            (values.normalizedUniqueFrom * weights.uniqueFromWeight) +
            (values.normalizedTve * weights.tveWeight)) / (weightFactor * 100));

        return reputableScore;
    }

    function _getCreate2Salt(string calldata _args, address account) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(_args, account));
    }

    function _getReputableHubStorage() private pure returns (ReputableHubStorage storage $) {
        //slither-disable-start assembly
        assembly {
            $.slot := REPUTABLE_HUB_STORAGE_LOCATION
        }
        //slither-disable-end assembly
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721Upgradeable, AccessControlUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
