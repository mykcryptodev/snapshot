<script setup>
import Plugin from '../index';
import networks from '@snapshot-labs/snapshot.js/src/networks.json';
import { getInstance } from '@snapshot-labs/lock/plugins/vue3';
import { sleep } from '@snapshot-labs/snapshot.js/src/utils';
import { ensureRightNetwork } from './SafeTransactions.vue';
import chainlinkExecutedJs from '../utils/chainlinkExecutedJs';

const props = defineProps([
  'batches',
  'proposal',
  'space',
  'results',
  'network',
  'chainlinkConsumerAddress',
  'multiSendAddress'
]);

const { formatDuration } = useIntl();
const { t } = useI18n();

const { clearBatchError } = useSafe();
const { web3 } = useWeb3();
const {
  createPendingTransaction,
  updatePendingTransaction,
  removePendingTransaction
} = useTxStatus();
const { notify } = useFlashNotification();
const { quorum } = useQuorum(props);

const plugin = new Plugin();

const ProposalStates = {
  error: -1,
  noWalletConnection: 0,
  loading: 1,
  waitingForResultsOnChain: 2,
  noTransactions: 3,
  completelyExecuted: 4,
  waitingForTransactionExecution: 5,
  quorumNotReached: 6,
  proposalApproved: 7
};
Object.freeze(ProposalStates);

const loading = ref(true);
const actionInProgress = ref(false);
const proposalStates = ref(ProposalStates);
const proposalDetails = ref(undefined);

const getTransactions = () => {
  return props.batches.map(batch => [
    batch.transactions[0].to,
    Number(batch.transactions[0].operation),
    batch.transactions[0].value,
    batch.transactions[0].data
  ]);
};

const updateDetails = async () => {
  loading.value = true;
  try {
    proposalDetails.value = await plugin.getExecutionDetailsChainlink(
      props.network,
      props.chainlinkConsumerAddress,
      props.proposal.id,
      getTransactions()
    );
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
};

const sendProposalResultsOnchain = async () => {
  const txPendingId = createPendingTransaction();
  try {
    actionInProgress.value = 'send-results-onchain';

    await ensureRightNetwork(props.network);

    const request = {
      source: chainlinkExecutedJs,
      secrets: [],
      secretsLocation: 0,
      args: [props.proposal.id]
    };
    const gasLimit = 300000;

    const transaction = plugin.fetchProposalResultsChainlink(
      props.network,
      getInstance().web3,
      props.chainlinkConsumerAddress,
      props.proposal.id,
      request,
      gasLimit
    );

    const step = await transaction.next();
    if (step.value)
      updatePendingTransaction(txPendingId, { hash: step.value.hash });
    actionInProgress.value = null;
    await transaction.next();
    notify(t('notify.youDidIt'));
    await sleep(3e3);
    await updateDetails();
  } catch (e) {
    console.error(e);
    actionInProgress.value = null;
  } finally {
    removePendingTransaction(txPendingId);
  }
};

const executeTxs = async () => {
  clearBatchError();
  const txPendingId = createPendingTransaction();
  try {
    actionInProgress.value = 'execute-txs';

    await ensureRightNetwork(props.network);

    const tx = props.batches[proposalDetails.value.txIndex].mainTransaction;

    const transaction = plugin.executeProposalWithHashesChainlink(
      getInstance().web3,
      props.chainlinkConsumerAddress,
      proposalDetails.value.proposalId,
      tx,
      proposalDetails.value.txIndex
    );

    const step = await transaction.next();
    if (step.value)
      updatePendingTransaction(txPendingId, { hash: step.value.hash });
    actionInProgress.value = null;
    await transaction.next();
    notify(t('notify.youDidIt'));
    await sleep(3e3);
    await updateDetails();
  } catch (e) {
    console.error(e);
    actionInProgress.value = null;
  } finally {
    removePendingTransaction(txPendingId);
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

  if (!proposalDetails.value) return ProposalStates.error;

  if (proposalDetails.value.noTransactions)
    return ProposalStates.noTransactions;

  const { hasCompletelyExecuted, hasResultsOnChain } = proposalDetails.value;

  if (hasCompletelyExecuted) return ProposalStates.completelyExecuted;

  if (Number(props.proposal.scores_total) < Number(quorum))
    return ProposalStates.quorumNotReached;

  if (!hasResultsOnChain) return ProposalStates.waitingForResultsOnChain;

  return ProposalStates.waitingForTransactionExecution;
});

const txIndex = computed(() => {
  return proposalDetails.value?.txIndex || 0;
});

onMounted(async () => {
  await updateDetails();
});
</script>

<template>
  <div v-if="proposalState === proposalStates.error" class="my-4">
    {{ $t('safeSnap.labels.error') }}
  </div>

  <div v-if="proposalState === proposalStates.noWalletConnection" class="my-4">
    {{ $t('safeSnap.labels.connectWallet') }}
  </div>

  <div v-if="proposalState === proposalStates.loading" class="my-4">
    <LoadingSpinner />
  </div>

  <div v-if="connectedToRightChain || usingMetaMask">
    <div v-if="proposalState === proposalStates.noTransactions" class="my-4">
      {{ $t('safeSnap.labels.noTransactions') }}
    </div>

    <div
      v-if="proposalState === proposalStates.waitingForResultsOnChain"
      class="my-4 inline-block"
    >
      <BaseContainer class="flex items-center">
        <BaseButton
          :loading="actionInProgress === 'send-results-onchain'"
          @click="sendProposalResultsOnchain"
          class="mr-2"
        >
          {{ $t('safeSnap.labels.sendResultsOnChain') }}
        </BaseButton>
        <BasePopoverHover placement="top">
          <template #button>
            <i-ho-information-circle />
          </template>
          <template #content>
            <div class="border bg-skin-bg p-3 text-md shadow-lg md:rounded-lg">
              {{ $t('safeSnap.labels.sendResultsOnChainTooltip') }}
            </div>
          </template>
        </BasePopoverHover>
      </BaseContainer>
    </div>

    <div
      v-if="proposalState === proposalStates.quorumNotReached"
      class="my-4 inline-block"
    >
      <BaseMessage level="warning-red">
        {{ $t('safeSnap.labels.quorumWarning') }}
      </BaseMessage>
    </div>

    <div
      v-if="proposalState === proposalStates.waitingForTransactionExecution"
      class="my-4 inline-block"
    >
      <BaseContainer class="flex items-center">
        <BaseButton
          :loading="actionInProgress === 'execute-txs'"
          @click="executeTxs"
          class="mr-2"
        >
          {{ $t('safeSnap.labels.executeTxs', [txIndex + 1, batches.length]) }}
        </BaseButton>
      </BaseContainer>
    </div>
  </div>
  <div
    v-else-if="
      proposalState !== proposalStates.loading &&
      proposalState !== proposalStates.noWalletConnection
    "
    class="my-4"
  >
    {{ $t('safeSnap.labels.switchChain', [networkName]) }}
  </div>

  <div v-if="proposalState === proposalStates.completelyExecuted" class="my-4">
    {{ $t('safeSnap.labels.executed') }}
  </div>
</template>
