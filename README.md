# Pre Setup

* Setup Company API. Instructions are published at:  
  https://github.com/OpenSTFoundation/company-api/blob/master/README.md

# Setup SaaS

* Install required packages.
```bash
> npm install
```

* Install RabbitMQ.
```bash
> brew install rabbitmq
```

* Start Redis.
```bash
> sudo redis-server --port 6379  --requirepass 'st123'
```

* Start Memcached.
```bash
> memcached -p 11211 -d
```

* Start RMQ for platform
```bash
> brew services restart rabbitmq
```

* Export ENV variables before platform setup. Update the config strategy path accordingly.
```bash
> source set_env_vars.sh
export OPENST_PLATFORM_PATH=$(pwd)/node_modules/@openstfoundation/openst-platform
export CONFIG_STRATEGY_PATH=$(pwd)/uc_1000.json
echo "export OPENST_PLATFORM_PATH=$(pwd)/node_modules/@openstfoundation/openst-platform" >> ~/.bash_profile
```

* Set utility gas price as "0" during setup.
```bash
export OST_UTILITY_GAS_PRICE='0x0'
```

* Delete the Dynamo DB data file if it exists. The data file resides at "$HOME/openst-setup/logs/shared-local-instance.db". We do this because deploy.js file will initiate the DB file creation again. 

* Setup Platform. Change utility chain id in the further steps accordingly.
```
> node tools/setup/platform/deploy.js $CONFIG_STRATEGY_PATH
```

* Create execute transaction process entry in process_queue_association table.
```bash
> node
rootPrefix = '.';
ProcessQueueAssociationModel = require(rootPrefix + '/app/models/process_queue_association');
params = {chain_id: 1000, process_id: 1, rmq_config_id: 0, queue_name_suffix: 'q1', status: 'available'};
new ProcessQueueAssociationModel().insertRecord(params).then(console.log);
```

* Update the addresses in uc_1000.json config strategy from ~/openst-setup/bin/utility-chain-1000/openst_platform_config.json.
    * This file uses config strategy for utility chain-id 1000 by default. If you are updating the addresses for some other chain-id, please make the necessary changes in the script.
    * Make sure to pass the absolute path of the config file in all places in the above script.
    ```bash
        node tools/setup/platform/address_update.js
    ```
    

* Start Utility Chain.
```bash
> sh ~/openst-setup/bin/utility-chain-1000/run-utility.sh 
```

* Setup Price Oracle.
```bash
> node tools/setup/price-oracle/deploy.js $CONFIG_STRATEGY_PATH

NOTE: Once the script runs successfully, you will get a price oracle address displayed in green color.  
Copy that address for "OST_UTILITY_PRICE_ORACLES" variable in the utility chain config strategy file (uc_1000.json).
```

* Setup Workers Contract.
```bash
> node tools/setup/payments/set_worker.js $CONFIG_STRATEGY_PATH

NOTE: Once the script runs successfully, you will get a workers contract address displayed in green color.  
Copy that address for "OST_UTILITY_WORKERS_CONTRACT_ADDRESS" variable in the utility chain config strategy file (uc_1000.json).
```

* Run OpenST Payments migrations.
```bash
> source set_env_vars.sh
NOTE: Manually create database in MySQL mentioned in $OP_MYSQL_DATABASE.  
Run the following commands after creating the database. 
> node node_modules/@openstfoundation/openst-payments/migrations/create_tables.js $CONFIG_STRATEGY_PATH
> node node_modules/@openstfoundation/openst-payments/migrations/alter_table_for_chain_id_column.js $CONFIG_STRATEGY_PATH
```

* Start Dynamo DB. Delete the previous DB copy.
```bash
> rm ~/openst-setup/logs/shared-local-instance.db
> java -Djava.library.path=~/dynamodb_local_latest/DynamoDBLocal_lib/ -jar ~/dynamodb_local_latest/DynamoDBLocal.jar -sharedDb -dbPath ~/openst-setup/logs/ 
```

* Execute commands related to DynamoDB migrations.
  * Create a fixed number of shards for all entities (number is in this file).
  ```bash
    source set_env_vars.sh
    node executables/create_init_shards.js $CONFIG_STRATEGY_PATH
  ```
  
  * Pick up the hash printed in green in previous step. Export shard arrays appropriately.
  
  ```bash
    export OS_DYNAMODB_TOKEN_BALANCE_SHARDS_ARRAY='["d_pk_token_balances_shard_001","d_pk_token_balances_shard_002"]'
    export OS_DYNAMODB_TRANSACTION_LOG_SHARDS_ARRAY='["d_pk_transaction_logs_shard_001","d_pk_transaction_logs_shard_002"]'
  ```
  
* Move the shared-local-instance.db file from $HOME/openst-setup/logs/ to $HOME/openst-setup/log/utility-chain-{id}/
```bash
mv ~/openst-setup/logs/shared-local-instance.db ~/openst-setup/logs/utility-chain-1000/
```
  
* Close all existing processes (for eg. utility chain, mysql, memcached, etc.) before proceeding further. 

* Use the seeder script to fill config_strategies table.
```bash
node executables/config_strategy_seed.js managed_address_salt_id group_id $CONFIG_STRATEGY_PATH
```

* Use the helper script to activate status of the seeded config strategy in node console. Replace the groupId.
```bash
> node
> Klass = require('./helpers/config_strategy/by_group_id');
b = new Klass(groupId);
b.activate();
```
                                         
# Start SAAS Services

* Start Redis.
```bash
> sudo redis-server --port 6379  --requirepass 'st123'
```

* Start Memcached.
```bash
> memcached -p 11211 -d
```

* Start RMQ for platform (RMQ in browser: http://127.0.0.1:15672).
```bash
> brew services start rabbitmq
```

* Start MySQL.
```bash
> mysql.server start
```

* Start value chain in new terminal.
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> sh $HOME/openst-setup/bin/run-value.sh
```
  
* Start utility chain in new terminal.
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> sh $HOME/openst-setup/bin/run-utility.sh
```

* Start Register Branded Token Intercom in new terminal.
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node executables/inter_comm/register_branded_token.js $HOME/openst-setup/logs/register_branded_token.data group_id
```

* Start Stake & Mint Intercom in new terminal.
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node executables/inter_comm/stake_and_mint.js $HOME/openst-setup/logs/stake_and_mint.data group_id
```

* Start Stake & Mint Processor Intercom in new terminal.
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node executables/inter_comm/stake_and_mint_processor.js $HOME/openst-setup/logs/stake_and_mint_processor.data group_id
```

* Start Stake Hunter Intercom in new terminal.
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node executables/inter_comm/stake_hunter.js $HOME/openst-setup/logs/stake_hunter.data group_id
```

* Start Processor to execute transactions in new terminal.
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node executables/rmq_subscribers/execute_transaction.js 1
```

* Start Block Scanner to mark mined transactions as done.  
Create a file called "block_scanner_execute_transaction.data" with initial content as: {"lastProcessedBlock":0}.  
Use the file path in the following command:
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node ./executables/block_scanner/for_tx_status_and_balance_sync.js 1 ~/openst-setup/logs/block_scanner_execute_transaction.data group_id <optional benchmarking file>
```

* Start worker to process events.
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node executables/rmq_subscribers/factory.js 1 'rmq_subscribers_factory_1' '["on_boarding.#","airdrop_allocate_tokens","stake_and_mint.#","event.stake_and_mint_processor.#","airdrop.approve.contract"]'
```

* Start APIs in new terminal.
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node app.js
```

* Start Cronjobs.
```bash
# Every hour
node executables/update_price_oracle_price_points.js group_id >> log/update_price_oracle_price_points.log
# Every five minutes
node executables/rmq_subscribers/send_error_emails.js >> log/send_error_emails.log
# Every minute
node executables/rmq_subscribers/start_airdrop.js >> log/start_airdrop.log
# Every five minutes
node executables/fund_addresses/by_reserve/st_prime.js >> log/fund_addresses_by_reserve_st_prime.log
# Every five minutes
node executables/fund_addresses/by_utility_chain_owner/eth.js group_id isChainSetUp(true/false) >> log/fund_addresses_by_utility_chain_owner_eth.log
# Every five minutes
node executables/fund_addresses/by_utility_chain_owner/st_prime.js group_id >> log/fund_addresses_by_utility_chain_owner_st_prime.log
# Every five minutes
node executables/fund_addresses/observe_balance_of_donors.js group_id >> log/observe_balance_of_donors.log
# Every minutes
node executables/rmq_subscribers/log_all_events.js >> log/log_all_events.log
```

# Helper Scripts

* Filling up missing nonce.
```bash
c = require('./executables/fire_brigade/fill_up_missing_nonce');
o = new c({from_address: '0x6bEeE57355885BAd8018814A0B0E93F368148c37', to_address: '0x180bA8f73897C0CB26d76265fC7868cfd936E617', chain_kind: 'value', missing_nonce: 25})
o.perform();
```

* Start all services. Change utility chain id accordingly.
```bash
NOTE: Create the file if not present.
> vim $HOME/openst-setup/data/utility-chain-1000/block_scanner_execute_transaction.data
  {"lastProcessedBlock":0}
  
> source set_env_vars.sh
> node start_value_services.js group_id
> node start_utility_services.js group_id
```

* Start Value Services script will start one transaction executing process. It expects at least one entry in
    process_queue_association table. If during on-boarding, you have more than 1 entry in the table, start the extra
    processes manually.

* Start block scanner. Change utility chain id accordingly.
```bash
# Start master process for Block scanner.
node executables/block_scanner/transaction_delegator.js --group-id 1000 --data-file-path ~/openst-setup/data/utility-chain-1000/block_scanner_execute_transaction.data --benchmark-file-path ~/openst-setup/logs/block_scanner_benchmark-1000.csv
```

```bash
# Start one worker process for block scanner.
node executables/rmq_subscribers/block_scanner.js --processlock-id processLockId --group-id group_id --prefetch-count prefetchCount --benchmark-file-path [~/openst-setup/logs/block_scanner_benchmark-1000.csv]
```

* Don't forget to start the cronjobs. 
