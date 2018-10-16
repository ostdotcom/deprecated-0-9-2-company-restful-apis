'use strict';

const rootPrefix = '../..',
  program = require('commander'),
  associateWorker = require(rootPrefix + '/lib/execute_transaction_management/associate_worker');

program
  .option('--clientId <clientId>', 'Client id')
  .option('--processIds <"[processIds]">', 'Process id array')
  .parse(process.argv);

program.on('--help', () => {
  console.log('');
  console.log('  Example:');
  console.log('');
  console.log(
    '    node ./executables/client_worker_process_management/associate_worker_commander.js --clientId 1000 --processIds "[1,2]" '
  );
  console.log('');
  console.log('');
});

// Validate and sanitize the commander parameters.
const validateAndSanitize = function() {
  if (!program.clientId || !program.processIds) {
    console.log('clientId', program.clientId);
    console.log('processIds', program.processIds);
    program.help();
    process.exit(1);
  } else {
    program.processIds = JSON.parse(program.processIds);
  }
};

const associate = function() {
  let params = {
      clientId: program.clientId,
      processIds: program.processIds
    },
    associateObject = new associateWorker(params); // Create class object
  associateObject.perform().then(console.log);
};

validateAndSanitize();
associate();
