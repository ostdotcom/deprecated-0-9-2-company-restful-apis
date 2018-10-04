# Code snippets for important tasks

## Create a new execute_transaction process. (Table: process_queue_association)

Use the code below in node console to create a new process entry in process_queue_association table.
```js
rootPrefix = '.';
ProcessQueueAssociationModel = require(rootPrefix + '/app/models/process_queue_association');
params = {
	process_id: 3,
	rmq_config_id: 0,
	queue_name_suffix: 'q3', // Examples: 'q1', 'q2'
	status: 'available' // Possible options: 'available', 'dedicated', 'full', 'killed'
};
new ProcessQueueAssociationModel().insertRecord(params).then(function() {
        console.log('Process entry created in the table.');
      }).catch(function() {
        console.log('Process entry could not be created in the table.');
      });
```

## Associate a client to transaction executing process(es).

The code below expects a clientId (number) and an array of processIds (Array{numbers}) which are supposed to be 
associated to the client. The code fetches the available worker addresses for the clientId passed and associates those workers
to the processIds passed.
```js
Klass = require('./lib/execute_transaction_management/associate_worker');  // Require the class.
clientId = 1040; // The clientId which needs to be associated to the new processes.
processIds = [3]; // The processIds which needs to be associated to the client.
params = {
  clientId: clientId, 
  processIds: processIds
};
obj = new Klass(params);  // Create class object
obj.perform().then(console.log);  // Start the association process.
```

## De-associate a client from transaction executing process(es).

The code below expects a clientId (number) and an array of processIds (Array{numbers}) which are supposed to be 
de-associated from the client. The code fetches the associated workers for the clientId passed and de-associates those workers
from the processIds passed.
```js
Klass = require('./lib/execute_transaction_management/deassociate_worker');  // Require the class.
clientId = 1040; // The clientId which needs to be de-associated from the processes.
processIds = [3]; // The processIds which needs to be de-associated from the client.
params = {
  clientId: clientId, 
  processIds: processIds
};
obj = new Klass(params);  // Create class object
obj.perform().then(console.log);  // Start the de-association process.
```