<script setup>
import { onMounted, ref, computed } from 'vue';
import Plugin from '../index';
import networks from '@snapshot-labs/snapshot.js/src/networks.json';
import { getInstance } from '@snapshot-labs/lock/plugins/vue3';
import { sleep } from '@snapshot-labs/snapshot.js/src/utils';
import { BigNumber } from '@ethersproject/bignumber';
import { formatUnits } from '@ethersproject/units';
import chainlinkExecutedJs from '../utils/chainlinkExecutedJs';

import {
  useWeb3,
  useI18n,
  useIntl,
  useFlashNotification,
  useTxStatus,
  useSafe
} from '@/composables';

import SafeSnapModalOptionApproval from './Modal/OptionApproval.vue';

const { formatRelativeTime } = useIntl();
const { t } = useI18n();

const { clearBatchError, setBatchError } = useSafe();
const { web3 } = useWeb3();
const { pendingCount } = useTxStatus();
const { notify } = useFlashNotification();

const props = defineProps([
  'batches',
  'proposal',
  'network',
  'chainlinkOracleAddress',
  'multiSendAddress'
]);

const plugin = new Plugin();

const ProposalStates = {
  error: -1,
  noWalletConnection: 0,
  loading: 1,
  waitingForResultOnChain: 2,
  waitingForCooldown: 5,
  waitingForExecution: 6,
  proposalRejected: 7,
  proposalNotResolved: 4,
  completelyExecuted: 8,
  timeExpired: 9
};
Object.freeze(ProposalStates);

const ensureRightNetwork = async chainId => {
  const chainIdInt = parseInt(chainId);
  const connectedToChainId = getInstance().provider.value?.chainId;
  if (connectedToChainId === chainIdInt) return; // already on right chain

  if (!window.ethereum || !getInstance().provider.value?.isMetaMask) {
    // we cannot switch automatically
    throw new Error(
      `Connected to wrong chain #${connectedToChainId}, required: #${chainId}`
    );
  }

  const network = networks[chainId];
  const chainIdHex = `0x${chainIdInt.toString(16)}`;

  try {
    // check if the chain to connect to is installed
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }] // chainId must be in hexadecimal numbers
    });
  } catch (error) {
    // This error code indicates that the chain has not been added to MetaMask. Let's add it.
    if (error.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: chainIdHex,
              chainName: network.name,
              rpcUrls: network.rpc,
              blockExplorerUrls: [network.explorer.url]
            }
          ]
        });
      } catch (addError) {
        console.error(addError);
      }
    }
    console.error(error);
  }

  await sleep(1e3); // somehow the switch does not take immediate effect :/
  if (window.ethereum.chainId !== chainIdHex) {
    throw new Error(
      `Could not switch to the right chain on MetaMask (required: ${chainIdHex}, active: ${window.ethereum.chainId})`
    );
  }
};

const loading = ref(true);
const proposalStates = ref(ProposalStates);
const actionInProgress = ref(false);
const action2InProgress = ref(false);
const proposalDetails = ref(undefined);
const modalApproveDecisionOpen = ref(false);

const getTxHashes = () => {
  return props.batches.map(batch => batch.hash);
};

const updateDetails = async () => {
  console.log('hashes', getTxHashes());
  loading.value = true;
  try {
    proposalDetails.value = await plugin.getExecutionDetailsWithHashesChainlink(
      props.network,
      props.chainlinkOracleAddress,
      props.proposal.id
    );
    console.log('proposalDetails', proposalDetails.value);
  } catch (e) {
    console.error('errors', e);
    proposalDetails.value = {
      waitingForResultOnChain: true
    };
  } finally {
    loading.value = false;
  }
};

const sendOutcomeOnChain = async () => {
  console.log('here we go...');

  if (!getInstance().isAuthenticated.value) return;
  action2InProgress.value = 'send-result-on-chain';
  console.log('sending...');
  try {
    // Build the parameters to make a request from the client contract
    const request = {
      source: chainlinkExecutedJs,
      secrets: [],
      secretsLocation: 0,
      args: [props.proposal.id]
    };
    const subscriptionId = 153; //36; //149;//14;
    const gasLimit = 300000;
    const transaction = plugin.sendResultOnChainViaChainlinkRequest(
      getInstance().web3,
      props.chainlinkOracleAddress,
      request,
      subscriptionId,
      gasLimit
    );
    await transaction.next();
    await transaction.next();
    notify(t('notify.youDidIt'));
    await sleep(3e3);
    await updateDetails();
    action2InProgress.value = null;
  } catch (err) {
    console.log({ err });
    action2InProgress.value = null;
    setBatchError(proposalDetails.value.nextTxIndex, err.reason);
  }
};

const executeProposal = async () => {
  if (!getInstance().isAuthenticated.value) return;
  action2InProgress.value = 'execute-proposal';
  try {
    await ensureRightNetwork(props.network);
  } catch (e) {
    console.error(e);
    action2InProgress.value = null;
    return;
  }

  try {
    clearBatchError();
    const transaction =
      props.batches[proposalDetails.value.nextTxIndex].mainTransaction;
    console.log({ proposalDetails, transaction });
    const executingProposal = plugin.executeProposalWithHashesChainlink(
      getInstance().web3,
      props.chainlinkOracleAddress,
      proposalDetails.value.proposalId,
      transaction,
      proposalDetails.value.nextTxIndex
    );
    await executingProposal.next();
    action2InProgress.value = null;
    pendingCount.value++;
    await executingProposal.next();
    notify(t('notify.youDidIt'));
    pendingCount.value--;
    await sleep(3e3);
    await updateDetails();
  } catch (err) {
    pendingCount.value--;
    action2InProgress.value = null;
    setBatchError(proposalDetails.value.nextTxIndex, err.reason);
  }
};

const usingMetaMask = computed(() => {
  return window.ethereum && getInstance().provider.value?.isMetaMask;
});

const connectedToRightChain = computed(() => {
  return getInstance().provider.value?.chainId === parseInt(props.network);
});

const networkName = computed(() => {
  return networks[props.network].name;
});

const proposalState = computed(() => {
  if (!web3.value.account) return ProposalStates.noWalletConnection;

  if (loading.value) return ProposalStates.loading;

  if (proposalDetails.waitingForResultOnChain)
    return ProposalStates.waitingForResultOnChain;

  if (proposalDetails.value.hasCompletelyExecuted)
    return ProposalStates.completelyExecuted;

  if (!proposalDetails.value.hasCompletelyExecuted)
    return ProposalStates.waitingForExecution;

  return ProposalStates.error;
});

onMounted(async () => {
  await updateDetails();
  console.log('moose', props);
});
</script>

<template>
  <div v-if="proposalState === ProposalStates.error" class="my-4">
    {{ $t('safeSnap.labels.error') }}
  </div>
  <div v-if="proposalState === proposalStates.proposalRejected" class="my-4">
    {{ $t('safeSnap.labels.rejected') }}
  </div>
  <div v-if="proposalState === ProposalStates.noWalletConnection" class="my-4">
    {{ $t('safeSnap.labels.connectWallet') }}
  </div>
  <div v-if="proposalState === ProposalStates.loading" class="my-4">
    <LoadingSpinner />
  </div>
  <div
    v-if="proposalState === proposalStates.waitingForResultOnChain"
    class="my-4"
  >
    <BaseButton
      :loading="action2InProgress === 'send-result-on-chain'"
      @click="sendOutcomeOnChain"
    >
      {{ $t('Send Results On-Chain') }}
    </BaseButton>
  </div>
  <div v-if="proposalState === proposalStates.waitingForExecution" class="my-4">
    <BaseButton
      :loading="action2InProgress === 'send-result-on-chain'"
      @click="sendOutcomeOnChain"
      class="mr-4"
    >
      {{ $t('Send Results On-Chain') }}
    </BaseButton>
    <BaseButton
      :loading="action2InProgress === 'execute-proposal'"
      @click="executeProposal"
    >
      {{
        $t('safeSnap.labels.executeTxs', [
          proposalDetails.nextTxIndex + 1,
          batches.length
        ])
      }}
    </BaseButton>
  </div>
  <div v-if="proposalState === ProposalStates.completelyExecuted" class="my-4">
    {{ $t('safeSnap.labels.executed') }}
  </div>
  <!-- <div v-if="false" class="my-4">
    <BaseButton
      :loading="action2InProgress === 'execute-proposal'"
      @click="(e) => { console.log(e, 'clicked') }"
    >
      {{
        $t('safeSnap.labels.executeTxs', [
          0,
          batches.length
        ])
      }}
    </BaseButton>
  </div> -->
  <!-- <div v-if="questionState === ProposalStates.error" class="my-4">
    {{ $t('safeSnap.labels.error') }}
  </div>

  <div v-if="questionState === ProposalStates.noWalletConnection" class="my-4">
    {{ $t('safeSnap.labels.connectWallet') }}
  </div>

  <div v-if="questionState === ProposalStates.loading" class="my-4">
    <LoadingSpinner />
  </div>

  <div v-if="connectedToRightChain || usingMetaMask">
    <div
      v-if="questionState === ProposalStates.waitingForQuestion"
      class="my-4"
    >
      <BaseButton
        :loading="actionInProgress === 'submit-proposal'"
        @click="submitProposal"
      >
        {{ $t('safeSnap.labels.request') }}
      </BaseButton>
    </div>

    <div v-if="questionState === ProposalStates.proposalApproved" class="my-4">
      <BaseButton
        :loading="action2InProgress === 'execute-proposal'"
        @click="executeProposal"
      >
        {{
          $t('safeSnap.labels.executeTxs', [
            questionDetails.nextTxIndex + 1,
            batches.length
          ])
        }}
      </BaseButton>
    </div>
  </div>
  <div
    v-else-if="
      questionState !== ProposalStates.loading &&
      questionState !== ProposalStates.noWalletConnection
    "
    class="my-4"
  >
    {{ $t('safeSnap.labels.switchChain', [networkName]) }}
  </div>

  <div v-if="questionState === ProposalStates.completelyExecuted" class="my-4">
    {{ $t('safeSnap.labels.executed') }}
  </div>

  <div v-if="questionState === ProposalStates.timeExpired" class="my-4">
    {{ $t('safeSnap.labels.expired') }}
  </div> -->
</template>
