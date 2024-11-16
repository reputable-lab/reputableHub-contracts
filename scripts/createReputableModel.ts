import { Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { getEventFromLogs } from '../test/helpers/getEventFromLogs';
import { randomNumber } from '../test/helpers/helpers';
import { ReputableHub, ReputableModel } from '../typechain-types';

export default async function main() {
  const reputableHubAddress = '0xA1a97Ac6d6f20c78e41F5A74568b51C025d5726F';
  const [sender] = await ethers.getSigners();

  const ReputableHub = await ethers.getContractFactory('ReputableHub');
  const reputableHub = ReputableHub.attach(reputableHubAddress) as ReputableHub;

  const defaultWeights = {
    commitWeight: 20,
    nbOfContributorWeight: 20,
    contributionRecencyWeight: 15,
    txWeight: 15,
    uniqueFromWeight: 15,
    tveWeight: 15,
  };

  const modelName = 'TestModel' + randomNumber();
  const tx = await reputableHub
    .connect(sender)
    .createReputableModel(modelName, Wallet.createRandom().address, defaultWeights);
  console.log('CreateReputableModel tx:', tx.hash);

  const receipt = await tx.wait();
  const event = getEventFromLogs({
    eventName: 'NewReputableModel',
    logs: receipt?.logs!,
  });

  const ReputableModel = await ethers.getContractFactory('ReputableModel');
  const model = ReputableModel.attach(event.args?.reputableModel) as ReputableModel;
  const weights = await model.getReputableModelWeights();
  console.log('Weights:', weights);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
