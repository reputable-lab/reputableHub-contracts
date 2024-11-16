import { expect } from 'chai';
import { Signer } from 'ethers';
import { ethers, upgrades } from 'hardhat';
import { ReputableHub, ReputableModel } from '../typechain-types';
import { getEventFromLogs } from './helpers/getEventFromLogs';
import { randomNumber } from './helpers/helpers';

describe('ReputableModel', () => {
  let sender: Signer;
  let defaultAdmin: Signer;
  let upgrader: Signer;
  let nonOwner: Signer;
  let reputableHub: ReputableHub;

  // Default weights that sum to 100
  const defaultWeights = {
    commitWeight: 20,
    nbOfContributorWeight: 20,
    contributionRecencyWeight: 15,
    txWeight: 15,
    uniqueFromWeight: 15,
    tveWeight: 15,
  };

  before(async () => {
    [sender, defaultAdmin, upgrader, nonOwner] = await ethers.getSigners();

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
  });

  describe('Model Management', () => {
    it('Should create a model with correct initial weights', async () => {
      const modelName = 'ReputableModel' + randomNumber();
      const tx = await reputableHub.createReputableModel(modelName, await sender.getAddress(), defaultWeights);

      const receipt = await tx.wait();
      const event = getEventFromLogs({
        eventName: 'NewReputableModel',
        logs: receipt?.logs!,
      });

      const ReputableModel = await ethers.getContractFactory('ReputableModel');
      const model = ReputableModel.attach(event.args?.reputableModel) as ReputableModel;
      const weights = await model.getReputableModelWeights();

      expect(weights.commitWeight).to.equal(defaultWeights.commitWeight);
      expect(weights.nbOfContributorWeight).to.equal(defaultWeights.nbOfContributorWeight);
      expect(weights.contributionRecencyWeight).to.equal(defaultWeights.contributionRecencyWeight);
      expect(weights.txWeight).to.equal(defaultWeights.txWeight);
      expect(weights.uniqueFromWeight).to.equal(defaultWeights.uniqueFromWeight);
      expect(weights.tveWeight).to.equal(defaultWeights.tveWeight);
    });

    it('Should prevent non-owner from updating weights', async () => {
      const modelName = 'NonOwnerModel' + randomNumber();
      const tx = await reputableHub.createReputableModel(modelName, await sender.getAddress(), defaultWeights);

      const receipt = await tx.wait();
      const event = getEventFromLogs({
        eventName: 'NewReputableModel',
        logs: receipt?.logs!,
      });

      const ReputableModel = await ethers.getContractFactory('ReputableModel');
      const model = ReputableModel.attach(event.args?.reputableModel) as ReputableModel;

      await expect(model.connect(nonOwner).updateReputableModel(defaultWeights)).to.be.revertedWithCustomError(
        model,
        'OwnableUnauthorizedAccount',
      );
    });
  });
});
