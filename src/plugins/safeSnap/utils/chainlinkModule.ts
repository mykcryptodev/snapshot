import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { defaultAbiCoder } from '@ethersproject/abi';
import { keccak256 } from '@ethersproject/keccak256';
import { multicall } from '@snapshot-labs/snapshot.js/src/utils';
import { CHAINLINK_CONSUMER_ABI } from '../constants';

export const getModuleDetailsChainlink = async (
  provider: StaticJsonRpcProvider,
  network: string,
  moduleAddress: string,
  transactions: any
): Promise<{
  dao: string;
  cooldown: number;
  proposalHash: string;
  noTransactions: boolean;
}> => {
  const moduleDetails = await multicall(
    network,
    provider,
    CHAINLINK_CONSUMER_ABI,
    [[moduleAddress, 'cooldown']]
  );
  let proposalHash;
  let noTransactions = true;
  if (transactions !== undefined) {
    proposalHash = keccak256(
      defaultAbiCoder.encode(
        ['(address to, uint8 operation, uint256 value, bytes data)[]'],
        [transactions]
      )
    );
    noTransactions = false;
  }

  return {
    dao: moduleAddress,
    cooldown: moduleDetails[0][0],
    proposalHash,
    noTransactions
  };
};

export const getProposalDetailsChainlink = async (
  provider: StaticJsonRpcProvider,
  network: string,
  moduleAddress: string,
  proposalId: string
): Promise<{
  hasCompletelyExecuted: boolean;
  hasResultsOnChain: boolean;
  txIndex: number;
}> => {
  console.log({ provider, network, moduleAddress, proposalId });
  const proposalDetails = await multicall(
    network,
    provider,
    CHAINLINK_CONSUMER_ABI,
    [
      [moduleAddress, 'hasCompletelyExecuted', [proposalId]],
      [moduleAddress, 'hasTxData', [proposalId]],
      [moduleAddress, 'proposals', [proposalId]]
    ]
  );

  return {
    hasCompletelyExecuted: proposalDetails[0][0],
    hasResultsOnChain: proposalDetails[1][0],
    txIndex: proposalDetails[2][0].toNumber()
  };
};
