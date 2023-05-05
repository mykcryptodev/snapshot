export const chainlinkExecutedJs =
  '// This example shows how to obtain the final results of snapshot.org off-chain vote outcome\n' +
  'const proposalId = args[0]\n' +
  "// Use snapshot's graphql API to get the final vote outcome\n" +
  'const snapshotRequest = () => Functions.makeHttpRequest({\n' +
  'url: `https://testnet.snapshot.org/graphql`, //`https://hub.snapshot.org/graphql`,\n' +
  'method: "POST",\n' +
  'data: {\n' +
  'query: `{\n' +
  'proposal(id: "${proposalId}") {\n' +
  'choices\n' +
  'plugins\n' +
  'quorum\n' +
  'scores\n' +
  'scores_state\n' +
  'scores_total\n' +
  '}\n' +
  '}`,\n' +
  '},\n' +
  '})\n' +
  'const { data, error } = await snapshotRequest()\n' +
  'if (error) {\n' +
  'throw Error("Snapshot request failed")\n' +
  '}\n' +
  'const { proposal } = data.data\n' +
  'const { choices, plugins, quorum, scores, scores_state, scores_total } = proposal\n' +
  'if (scores_state !== "final") {\n' +
  'throw Error("Snapshot vote is not final")\n' +
  '}\n' +
  'if (scores_total < quorum) {\n' +
  'throw Error("Snapshot vote quorum not reached")\n' +
  '}\n' +
  'const executableIf = plugins?.safeSnap?.executableIf\n' +
  'const winningChoice = choices[scores.indexOf(Math.max(...scores))]\n' +
  'const shouldExecute = executableIf === winningChoice\n' +
  'if (!shouldExecute) {\n' +
  'return Error("Snpashot vote outcome should not execute")\n' +
  '}\n' +
  'const executableTxs = plugins?.safeSnap?.executableTxs\n' +
  'const buffers = executableTxs.map(tx => {\n' +
  '// Remove the "0x" prefix from the transaction hash string\n' +
  'const strippedHash = tx.substring(2);\n' +
  '// Convert the stripped hash string to a Uint8Array\n' +
  'const byteArray = new Uint8Array(strippedHash.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));\n' +
  '// Convert the Uint8Array to a buffer\n' +
  'return Buffer.from(byteArray);\n' +
  '});\n' +
  'const concatenatedBuffer = Buffer.concat(buffers);\n' +
  'return concatenatedBuffer;\n';
export default chainlinkExecutedJs;
