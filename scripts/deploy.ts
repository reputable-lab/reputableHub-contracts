import { ethers, upgrades } from 'hardhat';

export default async function main() {
  // Retrieve signers
  const [deployer] = await ethers.getSigners();

  // Capture initial balance
  const initialBalance = await ethers.provider.getBalance(await deployer.getAddress());

  // SP Contract Address
  const SP_Address = '0xe19879c8e95F0AB16E539053335901c5a34D87e2';

  // Deploy Beacon with ReputableModel
  console.log('\n----------------------------------------------');
  const ReputableModel = await ethers.getContractFactory('ReputableModel', deployer);
  console.log('Deploying Beacon...');
  let balanceBefore = await ethers.provider.getBalance(await deployer.getAddress());
  const beaconContract = await upgrades.deployBeacon(ReputableModel);
  await beaconContract.waitForDeployment();
  let balanceAfter = await ethers.provider.getBalance(await deployer.getAddress());
  const beaconCost = balanceBefore - balanceAfter;
  console.log('Beacon deployed to:');
  console.log('Beacon deployment cost:', ethers.formatEther(beaconCost), 'ETH');

  // Deploy ReputableHub as a UUPS proxy
  console.log('\n----------------------------------------------');
  const ReputableHub = await ethers.getContractFactory('ReputableHub', deployer);
  console.log('Deploying ReputableHub...');
  balanceBefore = await ethers.provider.getBalance(await deployer.getAddress());
  const reputableHubContract = await upgrades.deployProxy(
    ReputableHub,
    [
      SP_Address,
      await beaconContract.getAddress(),
      await deployer.getAddress(), // defaultAdmin
      await deployer.getAddress(), // upgrader
    ],
    { kind: 'uups' },
  );
  await reputableHubContract.waitForDeployment();
  balanceAfter = await ethers.provider.getBalance(await deployer.getAddress());
  const hubCost = balanceBefore - balanceAfter;
  console.log('ReputableHub deployed to:', await reputableHubContract.getAddress());
  console.log('ReputableHub deployment cost:', ethers.formatEther(hubCost), 'ETH');

  // Capture final balance
  const finalBalance = await ethers.provider.getBalance(await deployer.getAddress());

  // Calculate total cost
  const totalCost = initialBalance - finalBalance;

  // Log total costs
  console.log('\n----------------------------------------------');
  console.log('\nDeployment Summary:');
  console.log('Total deployment cost:', ethers.formatEther(totalCost), 'ETH');

  return {
    contracts: { SP_Address, beaconContract, reputableHubContract },
    costs: {
      totalCost,
      breakdown: {
        beacon: beaconCost,
        hub: hubCost,
      },
    },
  };
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
