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
> brew services start rabbitmq
```

* Export ENV variables before platform setup. Update the config strategy path accordingly.
```bash
> source set_env_vars.sh
export OPENST_PLATFORM_PATH=$(pwd)/node_modules/@openstfoundation/openst-platform
export CONFIG_STRATEGY_PATH=path_to_company-restful-apis/uc_1000.json
echo "export OPENST_PLATFORM_PATH=$(pwd)/node_modules/@openstfoundation/openst-platform" >> ~/.bash_profile
```

* Fill up entries in the chain_geth_providers table.

* Set utility gas price as "0" during setup.
```bash
export OST_UTILITY_GAS_PRICE='0x0'
```

* Delete the Dynamo DB data file if it exists. The data file resides at "$HOME/openst-setup/logs/shared-local-instance.db". We do this because deploy.js file will initiate the DB file creation again. 

* Setup Platform. Change utility chain id in the further steps accordingly.
```
> node tools/setup/platform/deploy.js $CONFIG_STRATEGY_PATH
```

* Update the addresses in uc_1000.json config strategy from ~/openst-setup/bin/utility-chain-1000/openst_platform_config.json.
    * This file uses config strategy for utility chain-id 1000 by default. If you are updating the addresses for some other chain-id, please make the necessary changes in the script.
    ```bash
    node tools/setup/platform/address_update.js
    ```
    * Make sure to pass the absolute path of the config file in all places in the above script. 

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
> node node_modules/@openstfoundation/openst-payments/migrations/create_tables.js
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
  node executables/ddb_related_data_migrations/create_init_shards.js $CONFIG_STRATEGY_PATH
  ```
  
  Pick up the hash printed in green in previous step export shard arrays appropriately.
  
  ```bash
    export OS_DYNAMODB_TOKEN_BALANCE_SHARDS_ARRAY='["token_balances_shard_01101","token_balances_shard_01102"]'
    export OS_DYNAMODB_TRANSACTION_LOG_SHARDS_ARRAY='["transaction_log_shard_001", "transaction_log_shard_002"]'
  ```
  
* Move the shared-local-instance.db file from $HOME/openst-setup/logs/ to $HOME/openst-setup/bin/utility-chain-{id}/
```bash
mv ~/openst-setup/logs/shared-local-instance.db ~/openst-setup/logs/utility-chain-1000/
```
  
* Close all existing processes (for eg. utility chain, mysql, memcached, etc.) before proceeding further. 

* Use the seeder script to fill config_strategies table.
```bash
node executables/one_timers/config_strategy_seed.js managed_address_salt_id group_id $CONFIG_STRATEGY_PATH
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
> node executables/inter_comm/register_branded_token.js $HOME/openst-setup/logs/register_branded_token.data
```

* Start Stake & Mint Intercom in new terminal.
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node executables/inter_comm/stake_and_mint.js $HOME/openst-setup/logs/stake_and_mint.data
```

* Start Stake & Mint Processor Intercom in new terminal.
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node executables/inter_comm/stake_and_mint_processor.js $HOME/openst-setup/logs/stake_and_mint_processor.data
```

* Start Stake Hunter Intercom in new terminal.
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node executables/inter_comm/stake_hunter.js $HOME/openst-setup/logs/stake_hunter.data
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
> node ./executables/block_scanner/for_tx_status_and_balance_sync.js 1 ~/openst-setup/logs/block_scanner_execute_transaction.data
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
```base
# Every hour
node executables/update_price_oracle_price_points.js $CONFIG_STRATEGY_PATH >> log/update_price_oracle_price_points.log
# Every five minutes
node executables/rmq_subscribers/send_error_emails.js >> log/send_error_emails.log
# Every minute
node executables/rmq_subscribers/start_airdrop.js >> log/start_airdrop.log
# Every five minutes
node executables/fund_addresses/by_reserve/st_prime.js >> log/fund_addresses_by_reserve_st_prime.log
# Every five minutes
node executables/fund_addresses/by_utility_chain_owner/eth.js >> log/fund_addresses_by_utility_chain_owner_eth.log
# Every five minutes
node executables/fund_addresses/by_utility_chain_owner/st_prime.js >> log/fund_addresses_by_utility_chain_owner_st_prime.log
# Every five minutes
node executables/fund_addresses/observe_balance_of_donors.js >> log/observe_balance_of_donors.log
# Every minutes
node executables/rmq_subscribers/log_all_events.js >> log/log_all_events.log
```

# Helper Scripts

* Filling up missing nonce.
```
c = require('./fire_brigade/fill_up_missing_nonce');
o = new c({from_address: '0x6bEeE57355885BAd8018814A0B0E93F368148c37', to_address: '0x180bA8f73897C0CB26d76265fC7868cfd936E617', chain_kind: 'value', missing_nonce: 25})
o.perform();
```

* Start all services. Change utility chain id accordingly.
```bash
NOTE: Create the file if not present.
> vim $HOME/openst-setup/data/utility-chain-1000/block_scanner_execute_transaction.data
  {"lastProcessedBlock":0}
  
> source set_env_vars.sh
> node start_value_services.js $CONFIG_STRATEGY_PATH
> node start_utility_services.js $CONFIG_STRATEGY_PATH
```

* Start block scanner. Change utility chain id accordingly.
```bash
> touch $HOME/openst-setup/logs/block_scanner_benchmark-1000.csv
> node executables/block_scanner/for_tx_status_and_balance_sync.js 1 ~/openst-setup/data/utility-chain-1000/block_scanner_execute_transaction.data $CONFIG_STRATEGY_PATH ~/openst-setup/logs/block_scanner_benchmark-1000.csv >> ~/openst-setup/logs/utility-chain-1000/block_scanner_execute_transaction.log
```

* Don't forget to start the cronjobs. 
