'use strict';

const rootPrefix = '../..',
  program = require('commander'),
  deAssociateWorker = require(rootPrefix + '/lib/execute_transaction_management/deassociate_worker');

program
  .option('--clientId <clientId>', 'Client id')
  .option('--processIds <"[processIds]">', 'Process id array')
  .parse(process.argv);

program.on('--help', () => {
  console.log('');
  console.log('  Example:');
  console.log('');
  console.log(
    '    node ./executables/client_worker_process_management/deassociate_worker_commander.js --clientId 1008 --processIds "[1,2]" '
  );
  console.log('');
  console.log('');
});

// Validate and sanitize the commander parameters.
const validateAndSanitize = function() {
  if (!program.clientId || !program.processIds) {
    program.help();
    process.exit(1);
  } else {
    program.processIds = JSON.parse(program.processIds);
  }
};

const deAssociate = function() {
  let params = {
      clientId: program.clientId,
      processIds: program.processIds
    },
    deAssociateObject = new deAssociateWorker(params); // Create class object
  deAssociateObject.perform().then(console.log);
};

validateAndSanitize();
deAssociate();
