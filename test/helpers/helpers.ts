import { SignProtocolClient } from '@ethsign/sp-sdk';
import { Signer } from 'ethers';
import { ethers } from 'hardhat';
import { IReputableHub } from '../../typechain-types';
import { AttestationValues } from './types';

export const latest = async () => {
  const block = await ethers.provider.getBlock('latest');
  if (!block) {
    throw new Error('Unable to get the latest block');
  }

  return BigInt(block.timestamp);
};

export const randomNumber = () => Math.floor(Math.random() * 1e6).toString(); // Generates a number between 0 and 999999

export async function createAttestation({
  schemaId,
  client,
  sender,
}: {
  schemaId: string;
  client: SignProtocolClient;
  sender: Signer;
}) {
  return async function ({
    commitsCount,
    commitProportion,
    normalizedContributors,
    contributionRecency,
    normalizedTx,
    normalizedUniqueFrom,
    normalizedTve,
  }: AttestationValues): Promise<IReputableHub.OffChainAttestationInputStruct> {
    const attestationInfo = await client.createAttestation({
      schemaId: schemaId,
      data: {
        commitsCount: commitsCount,
        commitProportion: commitProportion,
        normalizedContributors: normalizedContributors,
        contributionRecency: contributionRecency,
        normalizedTx: normalizedTx,
        normalizedUniqueFrom: normalizedUniqueFrom,
        normalizedTve: normalizedTve,
      },
      indexingValue: 'Reputable',
    });

    const encodedData = ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(uint16,uint16,uint16,uint16,uint16,uint16,uint16)'],
      [
        [
          commitsCount,
          commitProportion,
          normalizedContributors,
          contributionRecency,
          normalizedTx,
          normalizedUniqueFrom,
          normalizedTve,
        ],
      ],
    );

    const messageHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'string'],
        [ethers.encodeBytes32String('ATTEST_OFFCHAIN'), attestationInfo.attestationId],
      ),
    );
    const messageHashBytes = ethers.getBytes(messageHash);
    const signature = await sender.signMessage(messageHashBytes);

    return {
      offchainAttestationId: attestationInfo.attestationId,
      data: encodedData,
      attester: await sender.getAddress(),
      signature: signature,
    };
  };
}
