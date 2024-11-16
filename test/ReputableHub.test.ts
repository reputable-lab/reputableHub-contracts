import { OffChainSignType, SignProtocolClient, SpMode } from '@ethsign/sp-sdk';
import { expect } from 'chai';
import 'dotenv/config';
import { Signer } from 'ethers';
import { ethers, upgrades } from 'hardhat';
import { privateKeyToAccount } from 'viem/accounts';
import { IReputableHub, ReputableHub } from '../typechain-types';
import { getEventFromLogs } from './helpers/getEventFromLogs';
import { createAttestation, randomNumber } from './helpers/helpers';
import { AttestationValues } from './helpers/types';

describe('ReputableHub', () => {
  let sender: Signer;
  let recipient: Signer;
  let defaultAdmin: Signer;
  let upgrader: Signer;
  let reputableHub: ReputableHub;

  let client: SignProtocolClient;
  let _createAttestation: ({
    commitsCount,
    commitProportion,
    normalizedContributors,
    contributionRecency,
    normalizedTx,
    normalizedUniqueFrom,
    normalizedTve,
  }: AttestationValues) => Promise<IReputableHub.OffChainAttestationInputStruct>;

  // Default weights that sum to 100
  const defaultWeights = {
    commitWeight: 30,
    nbOfContributorWeight: 10,
    contributionRecencyWeight: 1,
    txWeight: 10,
    uniqueFromWeight: 10,
    tveWeight: 30,
  };

  before(async () => {
    [sender, recipient, defaultAdmin, upgrader] = await ethers.getSigners();

    // SP Contract Address
    const SP_Address = '0xe19879c8e95F0AB16E539053335901c5a34D87e2';

    // Deploy Beacon
    const ReputableModel = await ethers.getContractFactory('ReputableModel');
    const beacon = await upgrades.deployBeacon(ReputableModel);
    await beacon.waitForDeployment();

    // Deploy ReputableHub
    const ReputableHub = await ethers.getContractFactory('ReputableHub');
    reputableHub = (await upgrades.deployProxy(
      ReputableHub,
      [SP_Address, await beacon.getAddress(), await defaultAdmin.getAddress(), await upgrader.getAddress()],
      { kind: 'uups' },
    )) as any as ReputableHub;
    await reputableHub.waitForDeployment();

    // Setup and SP schema
    client = new SignProtocolClient(SpMode.OffChain, {
      signType: OffChainSignType.EvmEip712,
      account: privateKeyToAccount(('0x' + process.env.DEFAULT_ADMIN_WALLET_PRIVATE_KEY) as any),
    });

    // Create schema
    const { schemaId } = await client.createSchema({
      name: 'ReputableSchema',
      data: [
        { name: 'commitsCount', type: 'uint16' },
        { name: 'commitProportion', type: 'uint16' },
        { name: 'normalizedContributors', type: 'uint16' },
        { name: 'contributionRecency', type: 'uint16' },
        { name: 'normalizedTx', type: 'uint16' },
        { name: 'normalizedUniqueFrom', type: 'uint16' },
        { name: 'normalizedTve', type: 'uint16' },
      ],
    });

    // Create attestation
    _createAttestation = await createAttestation({
      schemaId,
      client,
      sender,
    });
  });

  describe('Model Creation', () => {
    it('Should create a ReputableModel with valid weights', async () => {
      const modelName = 'ReputableModel' + randomNumber();
      const tx = await reputableHub.createReputableModel(modelName, await sender.getAddress(), defaultWeights);

      const receipt = await tx.wait();
      const event = getEventFromLogs({
        eventName: 'NewReputableModel',
        logs: receipt?.logs!,
      });

      const predictedAddress = await reputableHub.predictReputableModel(modelName, await sender.getAddress());
      expect(predictedAddress).to.equal(event.args?.reputableModel);
    });

    it('Should fail to create a ReputableModel with invalid weights sum', async () => {
      const invalidWeights = {
        ...defaultWeights,
        commitWeight: 90, // Makes total sum > 100
      };

      await expect(
        reputableHub.createReputableModel('InvalidModel' + randomNumber(), await sender.getAddress(), invalidWeights),
      ).to.be.revertedWithCustomError(reputableHub, 'WeightsSumExceedsLimit');
    });
  });

  describe('Reputation Scoring', () => {
    let reputableModelAddress: string;

    beforeEach(async () => {
      // Create fresh ReputableModel for each test
      const modelName = 'TestModel' + randomNumber();
      const tx = await reputableHub.createReputableModel(modelName, await sender.getAddress(), defaultWeights);
      const receipt = await tx.wait();
      const event = getEventFromLogs({
        eventName: 'NewReputableModel',
        logs: receipt?.logs!,
      });
      reputableModelAddress = event.args?.reputableModel;
    });

    it('Should calculate reputation score correctly for low commit count (≤10)', async () => {
      const attestation = await _createAttestation({
        commitsCount: 5,
        commitProportion: 80,
        normalizedContributors: 70,
        contributionRecency: 90,
        normalizedTx: 85,
        normalizedUniqueFrom: 75,
        normalizedTve: 65,
      });

      const score = Number(await reputableHub.proveReputableScore(attestation, reputableModelAddress));
      expect(score).to.be.gt(0);

      const expectedScore = Math.trunc(
        (80 * (defaultWeights.commitWeight / 10) +
          70 * (defaultWeights.nbOfContributorWeight / 10) +
          90 * (defaultWeights.contributionRecencyWeight / 10) +
          85 * (defaultWeights.txWeight / 10) +
          75 * (defaultWeights.uniqueFromWeight / 10) +
          65 * (defaultWeights.tveWeight / 10)) /
          100,
      );

      expect(score).to.equal(expectedScore);
    });

    it('Should calculate reputation score correctly for medium commit count (11-30)', async () => {
      const attestation = await _createAttestation({
        commitsCount: 20,
        commitProportion: 80,
        normalizedContributors: 70,
        contributionRecency: 90,
        normalizedTx: 85,
        normalizedUniqueFrom: 75,
        normalizedTve: 65,
      });

      const score = Number(await reputableHub.proveReputableScore(attestation, reputableModelAddress));

      const expectedScore = Math.trunc(
        (80 * (defaultWeights.commitWeight / 2) +
          70 * (defaultWeights.nbOfContributorWeight / 2) +
          90 * (defaultWeights.contributionRecencyWeight / 2) +
          85 * (defaultWeights.txWeight / 2) +
          75 * (defaultWeights.uniqueFromWeight / 2) +
          65 * (defaultWeights.tveWeight / 2)) /
          100,
      );

      expect(score).to.equal(expectedScore);
    });

    it('Should calculate reputation score correctly for high commit count (>30)', async () => {
      const attestation = await _createAttestation({
        commitsCount: 40,
        commitProportion: 80,
        normalizedContributors: 70,
        contributionRecency: 90,
        normalizedTx: 85,
        normalizedUniqueFrom: 75,
        normalizedTve: 65,
      });

      const score = Number(await reputableHub.proveReputableScore(attestation, reputableModelAddress));

      const expectedScore = Math.trunc(
        (80 * defaultWeights.commitWeight +
          70 * defaultWeights.nbOfContributorWeight +
          90 * defaultWeights.contributionRecencyWeight +
          85 * defaultWeights.txWeight +
          75 * defaultWeights.uniqueFromWeight +
          65 * defaultWeights.tveWeight) /
          100,
      );

      expect(score).to.equal(expectedScore);
    });

    it('Should reject invalid attestation', async () => {
      const invalidAttestation = await _createAttestation({
        commitsCount: 40,
        commitProportion: 80,
        normalizedContributors: 70,
        contributionRecency: 90,
        normalizedTx: 85,
        normalizedUniqueFrom: 75,
        normalizedTve: 65,
      });
      invalidAttestation.signature = ethers.encodeBytes32String('Wrong_Signature');

      await expect(
        reputableHub.proveReputableScore(invalidAttestation, reputableModelAddress),
      ).to.be.revertedWithCustomError(reputableHub, 'InvalidAttestation');
    });

    it('Should reject non-existing reputable model', async () => {
      const attestation = await _createAttestation({
        commitsCount: 40,
        commitProportion: 80,
        normalizedContributors: 70,
        contributionRecency: 90,
        normalizedTx: 85,
        normalizedUniqueFrom: 75,
        normalizedTve: 65,
      });

      await expect(reputableHub.proveReputableScore(attestation, ethers.ZeroAddress)).to.be.revertedWithCustomError(
        reputableHub,
        'InvalidReputableModel',
      );
    });
  });
});
