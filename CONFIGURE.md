# Code snippets for important tasks.

## Create a new process and associate and de-associate clients. Run this code on the SAAS API machine.

### Create a new execute_transaction process.

1. Use the code below in node console to create a new process entry in process_queue_association table.
    ```js
    rootPrefix = '.';
    ProcessQueueAssociationModel = require(rootPrefix + '/app/models/process_queue_association');
    params = {
        chain_id: number,
        process_id: number,
        rmq_config_id: number,
        queue_name_suffix: 'string', // Examples: 'q1', 'q2'
        status: 'string' // Possible options: 'available', 'dedicated', 'full', 'killed'
    };
    new ProcessQueueAssociationModel().insertRecord(params).then(function() {
            console.log('Process entry created in the table.');
          }).catch(function() {
            console.log('Process entry could not be created in the table.');
          });
    ```

2. Start the service for the new process. 
    ```bash
    sudo systemctl start execute_transaction@processId.service
    ```

### Associate a client to transaction executing process(es).

The code below expects a clientId (number) and an array of processIds (Array{numbers}) which are supposed to be 
associated to the client. The code fetches the available workers for the clientId passed and associates those workers
to the processIds passed.
```js
Klass = require('./lib/execute_transaction_management/associate_worker');  // Require the class.
clientId = 1001; // The clientId which needs to be associated to the new processes.
processIds = [4, 5, 6]; // The processIds which needs to be associated to the client.
params = {
  clientId: clientId, 
  processIds: processIds
};
obj = new Klass(params);  // Create class object
obj.perform().then(console.log);  // Start the association process.
```

### De-associate a client from transaction executing process(es).

The code below expects a clientId (number) and an array of processIds (Array{numbers}) which are supposed to be 
de-associated from the client. The code fetches the associated workers for the clientId passed and de-associates those workers
from the processIds passed.
```js
Klass = require('./lib/execute_transaction_management/deassociate_worker');  // Require the class.
clientId = 1001; // The clientId which needs to be de-associated from the processes.
processIds = [4, 5, 6]; // The processIds which needs to be de-associated from the client.
params = {
  clientId: clientId, 
  processIds: processIds
};
obj = new Klass(params);  // Create class object
obj.perform().then(console.log);  // Start the de-association process.
```


### Fetch user balance
```js
require('./module_overrides/index');
InstanceComposer = require('./instance_composer');
ConfigStartegyHelper = require('./helpers/config_strategy');

configStrategyHelper = new ConfigStartegyHelper();

cs = {};
configStrategyHelper.getConfigStrategy(1040).then(function(response){cs = response.data});

ic = new InstanceComposer(cs)

require('./lib/providers/storage')

storageProvider = ic.getStorageProvider()
openSTStorage = storageProvider.getInstance()
new openSTStorage.cache.TokenBalance({erc20_contract_address: '0xe789F467B338C8Ac1f3480D6b454eE80C336AdD0',ethereum_addresses: ['0x2064402f4EEF7c5EDED6C0fD1F84400c7B0Ee9c9']}).fetch().then(console.log)

```
