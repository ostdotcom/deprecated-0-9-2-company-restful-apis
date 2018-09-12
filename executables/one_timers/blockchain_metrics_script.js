/**
 * Usage: executables/one_timers/blockchain_metrics_script.js provider_endpoint start_block_number end_block_number
 *
 *
 * @type {Array}
 */
const args = process.argv,
  provider = args[2],
  startBlock = args[3],
  endBlock = args[4];

const Web3 = require('web3');
let web3 = new Web3(provider);

let totalBlockTxCount = 0,
  totalTxCount = 0;

const GetCount = function() {};

GetCount.prototype = {
  perform: async function() {
    let st = parseInt(startBlock),
      end = parseInt(endBlock);

    for (let i = st; i <= end; i++) {
      let totalBlockTxCount = await web3.eth.getBlockTransactionCount(i);

      console.log('For Block Number: ' + i + ' has total Tx : ' + JSON.stringify(totalBlockTxCount));

      totalTxCount = totalTxCount + totalBlockTxCount;
    }
  }
};

let obj = new GetCount();

obj.perform().then(function(r) {
  let averageTxCount = totalTxCount / (endBlock - startBlock);

  console.log('\ntotalTxCount for given range (Cumulative txCount): ', totalTxCount);

  console.log('\naverageTxCount for given range', averageTxCount);

  console.log('====Finished====');
  process.exit(0);
});
