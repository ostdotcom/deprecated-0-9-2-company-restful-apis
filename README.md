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

* Export ENV variables before platform setup.
```bash
> source set_env_vars.sh
# Temporarily set redis caching engine for Platform and memcached for SAAS. We will set it permanently later on.
export OST_CACHING_ENGINE='redis'
export OST_DEFAULT_TTL='36000'
export OST_REDIS_HOST='127.0.0.1'
export OST_REDIS_PORT=6379
export OST_REDIS_PASS=st123
export OST_REDIS_TLS_ENABLED=0
export OST_MEMCACHE_SERVERS='127.0.0.1:11211'
export OPENST_PLATFORM_PATH=$(pwd)/node_modules/@openstfoundation/openst-platform
export OST_UTILITY_GAS_PRICE='0x0'
export OST_VALUE_GAS_PRICE='0xBA43B7400'
echo "export OPENST_PLATFORM_PATH=$(pwd)/node_modules/@openstfoundation/openst-platform" >> ~/.bash_profile
```

* Delete the Dynamo DB data file if it exists. The data file resides at "$HOME/openst-setup/logs/shared-local-instance.db". We do this because deploy.js file will initiate the DB file creation again. 

* Setup Platform.
```
> node tools/setup/platform/deploy.js
```

* Update environment variables in $HOME/openst-setup/openst_env_vars.sh.
```bash
> vim $HOME/openst-setup/openst_env_vars.sh
# Enable Redis for platform.
export OST_CACHING_ENGINE='redis'
export OST_DEFAULT_TTL='36000'
export OST_REDIS_HOST='127.0.0.1'
export OST_REDIS_PORT=6379
export OST_REDIS_PASS=st123
export OST_REDIS_TLS_ENABLED=0

# Enable memcached for SAAS.
export OST_MEMCACHE_SERVERS='127.0.0.1:11211'

# Enable RabbitMQ for platform.
export OST_RMQ_SUPPORT='1'
export OST_RMQ_HOST='127.0.0.1'
export OST_RMQ_PORT='5672'
export OST_RMQ_USERNAME='guest'
export OST_RMQ_PASSWORD='guest'
export OST_RMQ_HEARTBEATS='30'
```

* Start Utility Chain.
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> sh $HOME/openst-setup/bin/run-utility.sh
```

* Setup Price Oracle.
```bash
> vim $HOME/openst-setup/openst_env_vars.sh
export OST_UTILITY_PRICE_ORACLES='{}'

> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node tools/setup/price-oracle/deploy.js

NOTE: Once the script runs successfully, you will get a price oracle address displayed in green color.  
Copy that address and replace it with "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" in the command below.

> vim $HOME/openst-setup/openst_env_vars.sh
# 3rd party contract address
export OST_UTILITY_PRICE_ORACLES='{"OST":{"USD":"0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}}'
```

* Setup Workers Contract.
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node tools/setup/payments/set_worker.js

NOTE: Once the script runs successfully, you will get a workers contract address displayed in green color.  
Copy that address and replace it with "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" in the command below.

> vim $HOME/openst-setup/openst_env_vars.sh
# 3rd party contract address
export OST_UTILITY_WORKERS_CONTRACT_ADDRESS='0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
```

* Run OpenST Payments migrations.
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
NOTE: Manually create database in MySQL mentioned in $OP_MYSQL_DATABASE.  
Run the following command after creating the database. 
> node node_modules/@openstfoundation/openst-payments/migrations/create_tables.js
```

* Start Dynamo DB.
```bash
> java -Djava.library.path=~/dynamodb_local_latest/DynamoDBLocal_lib/ -jar ~/dynamodb_local_latest/DynamoDBLocal.jar -sharedDb -dbPath ~/openst-setup/logs/ 
```

* Execute commands related to DynamoDB migrations.
  * Create tables needed for DDB framework.
  ```bash
  node executables/ddb_related_data_migrations/create_init_ddb_tables.js
  ```
  * Create a fixed number of shards for all entities (number is in this file).
  ```bash
  node executables/ddb_related_data_migrations/create_shards.js
  ```
  
* Close all existing processes (for eg. utility chain, mysql, memcached, etc.) before proceeding further. 

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

* Start Hunter Intercom in new terminal.
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node executables/inter_comm/hunter.js $HOME/openst-setup/logs/hunter.data
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
node executables/update_price_oracle_price_points.js >> log/update_price_oracle_price_points.log
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

* Start all services.
```bash
NOTE: Create the file if not present.
> vim $HOME/openst-setup/logs/block_scanner_execute_transaction.data
  {"lastProcessedBlock":0}
  
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node start_services.js

```

* Don't forget to start the cronjobs. 
