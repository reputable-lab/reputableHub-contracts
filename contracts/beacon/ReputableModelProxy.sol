// SPDX-FileCopyrightText: 2024 REPUTABLE <contact@reputable.network>
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @title Beacon proxy contract instance that is deployed per user.
 * @notice Deployed by the ReputableHub contract.
 * @dev /!\ Important notice:
 *  When updating this `ReputableModelProxy` contract (when bumping open-zeppelin version
 *  for instance).
 */
contract ReputableModelProxy is BeaconProxy {
    /**
     * @dev /!\ Caution if this contract is deployed without using the
     * ReputableHub contract.
     * @dev /!\ Do not forget to initialize this contract after creation,
     * ideally, in the same transaction.
     *
     * @dev This contract is deployed by the ReputableHub contract using create2
     * mechanism. The initialization process is excluded from the constructor
     * to make computing the contract address easier and not dependent
     * on a lot of inputs (constructor args) that could later be difficult to
     * gather. In this case, computing the address of the contract requires
     * knowing its bytecode, the used salt (contract owner address + args), and only
     * one constructor argument (beaconAddress) which is already available in the
     * storage of the factory contract (ReputableHub).
     *
     * @param beaconAddress used by the proxy.
     */
    constructor(address beaconAddress) BeaconProxy(beaconAddress, new bytes(0)) {}

    receive() external payable {
        revert("ReputableModelProxy: Receive function not supported");
    }

    /**
     * Get implementation address.
     * @dev Used in tests.
     */
    function implementation() external view returns (address) {
        return _implementation();
    }
}
