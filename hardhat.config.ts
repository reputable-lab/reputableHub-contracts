import '@nomicfoundation/hardhat-foundry';
import '@nomicfoundation/hardhat-toolbox';
import '@nomiclabs/hardhat-solhint';
import '@openzeppelin/hardhat-upgrades';
import 'dotenv/config';
import 'hardhat-dependency-compiler';
import 'hardhat-deploy';
import type { HardhatUserConfig } from 'hardhat/config';

const {
  INFURA_API_KEY,
  ALCHEMY_API_KEY,
  DEPLOYER_WALLET_PRIVATE_KEY,
  DEFAULT_ADMIN_WALLET_PRIVATE_KEY,
  UPGRADER_WALLET_PRIVATE_KEY,
} = process.env;

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      forking: {
        enabled: true,
        url: `https://unichain-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      },
    },
    unichain: {
      chainId: 1301,
      url: `https://unichain-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [DEFAULT_ADMIN_WALLET_PRIVATE_KEY!, DEPLOYER_WALLET_PRIVATE_KEY!, UPGRADER_WALLET_PRIVATE_KEY!],
    },
    'local-fork': {
      url: 'http://127.0.0.1:8545',
    },
  },

  // gas reporter
  gasReporter: {
    enabled: true,
  },

  // to verify smart-contract on Blockscout
  etherscan: {
    apiKey: {
      bellecour: 'abc',
    },
    customChains: [
      {
        network: 'unichain',
        chainId: 1301,
        urls: {
          apiURL: 'https://unichain-sepolia.blockscout.com/api',
          browserURL: 'https://unichain-sepolia.blockscout.com/',
        },
      },
    ],
  },

  sourcify: {
    enabled: false,
  },

  solidity: {
    compilers: [
      {
        version: '0.8.27',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000000,
          },
          metadata: {
            bytecodeHash: 'none',
          },
        },
      },
      {
        version: '0.8.26',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000000,
          },
          metadata: {
            bytecodeHash: 'none',
          },
        },
      },
    ],
  },

  dependencyCompiler: {
    paths: [
      '@ethereum-attestation-service/eas-contracts/contracts/EAS.sol',
      '@ethereum-attestation-service/eas-contracts/contracts/SchemaRegistry.sol',
    ],
  },

  typechain: {
    target: 'ethers-v6',
  },

  mocha: {
    color: true,
    bail: true,
  },
};

export default config;
