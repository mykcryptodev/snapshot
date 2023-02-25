import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { multicall } from '@snapshot-labs/snapshot.js/src/utils';
import { CHAINLINK_MODULE_ABI, ORACLE_ABI } from '../constants';
import { HashZero } from '@ethersproject/constants';
import { BigNumber } from '@ethersproject/bignumber';
import { keccak256 as solidityKeccak256 } from '@ethersproject/solidity';

export const getChainlinkExecutionDetails = async (
  provider: StaticJsonRpcProvider,
  network: string,
  oracleAddress: string,
  proposalId: string | undefined
): Promise<{
  hasCompletelyExecuted: boolean;
  txIndexToExecute: number | undefined;
}> => {
  if (proposalId) {
    try {
      const result = await multicall(network, provider, CHAINLINK_MODULE_ABI, [
        [oracleAddress, 'hasCompletelyExecuted', [proposalId]],
        [oracleAddress, 'txIndexToExecute', [proposalId]]
      ]);

      return {
        hasCompletelyExecuted: result[0][0],
        txIndexToExecute: result[1][0].toNumber()
      };
    } catch (e) {
      // We expect an error while the proposal is not on chain yet
    }
  }
  return {
    hasCompletelyExecuted: false,
    txIndexToExecute: undefined
  };
};
