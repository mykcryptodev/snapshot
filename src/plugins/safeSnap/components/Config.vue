<script>
import { clone } from '@snapshot-labs/snapshot.js/src/utils';
import { coerceConfig, isValidInput, getSafeHash } from '../index';
import { defaultAbiCoder } from '@ethersproject/abi';
import { AddressZero } from '@ethersproject/constants';
import { keccak256 } from '@ethersproject/keccak256';

import SafeTransactions from './SafeTransactions.vue';

export default {
  components: { SafeTransactions },
  props: [
    'modelValue', // proposal's plugins.safeSnap field or undefined when creating a new proposal
    'config', // the safeSnap plugin config of the current space
    'network', // network of the space (needed when mapping legacy plugin configs)
    'proposal',
    'preview' // if true, renders a read-only view
  ],
  emits: ['update:modelValue'],
  data() {
    let executableIf, txString, input;
    if (!Object.keys(this.modelValue).length) {
      input = {
        safes: coerceConfig(this.config, this.network).safes.map(safe => ({
          ...safe,
          hash: null,
          txs: []
        })),
        valid: true,
        txString: 'hello',
        executableIf: this.proposal.choices[0].text
      };
      txString = 'hello';
      executableIf = this.proposal.choices[0].text;
    } else {
      const value = clone(this.modelValue);
      if (value.safes && this.config && Array.isArray(this.config.safes)) {
        value.safes = value.safes.map((safe, index) => ({
          ...this.config.safes[index],
          ...safe
        }));
        // console.log('safe', value?.safes);
        txString = keccak256(
          defaultAbiCoder.encode(
            ['address', 'uint256', 'bytes', 'uint8'],
            [
              value.safes[0]?.txs[0]?.transactions[0]?.to,
              value.safes[0]?.txs[0]?.transactions[0]?.value,
              value.safes[0]?.txs[0]?.transactions[0]?.data,
              value.safes[0]?.txs[0]?.transactions[0]?.operation
            ]
          )
        );
        // const hashes = value.safes[0].txs[0].transactions.map(tx => {
        //   return keccak256(defaultAbiCoder.encode(
        //     ['address', 'uint256', 'bytes', 'uint8'],
        //     [
        //       tx.to,
        //       tx.value,
        //       tx.data,
        //       tx.operation
        //     ]
        //   ));
        // });
        // console.log('hashes', hashes);
        // const encoded = defaultAbiCoder.encode(
        //   ['bytes32[]'],
        //   [hashes]
        // );
        // console.log('encoded', encoded);
        // txString = keccak256(encoded);
        // txString = keccak256(['bytes32[]'], value.safes[0].txs[0].transactions.map(tx => {
        //   return keccak256(defaultAbiCoder.encode(
        //     ['address', 'uint256', 'bytes', 'uint8'],
        //     [
        //       tx.to,
        //       tx.value,
        //       tx.data,
        //       tx.operation
        //     ]
        //   ));
        // }));
        // txString = getChainlinkFunctionHash(value.safes[0]);
        // console.log('encoded', txString)
        console.log('keccaked', txString);
        value.txString = txString;
      } else {
        txString = 'goodbye';
      }
      input = coerceConfig(value, this.network);
      executableIf = input.executableIf;
    }
    console.log({ txString });
    return { input, executableIf, txString };
  },
  methods: {
    updateSafeTransactions() {
      if (this.preview) return;
      this.input.executableIf = this.executableIf;
      this.input.valid = isValidInput(this.input);
      this.input.safes = this.input.safes.map(safe => {
        return {
          ...safe,
          hash: getSafeHash(safe)
        };
      });
      this.input.txString = keccak256(
        defaultAbiCoder.encode(
          ['address', 'uint256', 'bytes', 'uint8'],
          [
            this.input.safes[0]?.txs[0]?.transactions[0]?.to || AddressZero,
            this.input.safes[0]?.txs[0]?.transactions[0]?.value || '0',
            this.input.safes[0]?.txs[0]?.transactions[0]?.data || '0x',
            this.input.safes[0]?.txs[0]?.transactions[0]?.operation || 0
          ]
        )
      );
      // this.input.txString = getChainlinkFunctionHash(this.input.safes[0]);
      // this.input.txString = keccak256(defaultAbiCoder.encode(
      //   ['address', 'uint256', 'bytes', 'uint8'],
      //   [
      //     this.input.safes[0]?.txs[0]?.transactions[0]?.to || AddressZero,
      //     this.input.safes[0]?.txs[0]?.transactions[0]?.value || '0',
      //     this.input.safes[0]?.txs[0]?.transactions[0]?.data || '0x',
      //     this.input.safes[0]?.txs[0]?.transactions[0]?.operation || 0
      //   ]
      // ));
      this.$emit('update:modelValue', this.input);
    },
    updateExecutableIf(executableIf) {
      this.executableIf = executableIf;
      this.updateSafeTransactions();
    }
  }
};
</script>

<template>
  <div
    v-if="!preview || input.safes.length > 0"
    class="mb-4 rounded-none border-t border-b bg-skin-block-bg md:rounded-xl md:border"
  >
    <h4 class="block border-b px-4 pt-3" style="padding-bottom: 12px">
      {{ $t('safeSnap.transactions') }}
    </h4>
    <div
      v-for="(safe, index) in input.safes"
      :key="index"
      class="border-b last:border-b-0"
    >
      <SafeTransactions
        v-if="!preview || safe.txs.length > 0"
        :preview="preview"
        :proposal="proposal"
        :hash="safe.hash"
        :network="safe.network"
        :chainlink-oracle-address="safe.chainlinkOracleAddress"
        :reality-address="safe.realityAddress"
        :uma-address="safe.umaAddress"
        :multi-send-address="safe.multiSendAddress"
        :model-value="safe.txs"
        @update:modelValue="updateSafeTransactions(index, $event)"
        @update:executableIf="updateExecutableIf($event)"
      />
    </div>
  </div>
</template>
