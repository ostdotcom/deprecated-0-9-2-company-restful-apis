# Pre Setup

* Setup Company API. Instrunctions are published: https://github.com/OpenSTFoundation/company-api/blob/master/README.md

# Setup Saas

* Install required packages
```bash
> npm install
```

* Install RabbitMQ
```bash
> brew install rabbitmq
```

* Start redis
```bash
> sudo redis-server --port 6379  --requirepass 'st123'
```

* Start memcached
```bash
> memcached -p 11211 -d
```

* Start RMQ for platform
```bash
> brew services start rabbitmq
```

* Setup Platform
```bash
> source set_env_vars.sh
# Temporarily set redis caching engine for Platform and memcached for SAAS. We will set it permanently later on.
> export OST_CACHING_ENGINE='redis'
> export OST_DEFAULT_TTL='36000'
> export OST_REDIS_HOST='127.0.0.1'
> export OST_REDIS_PORT=6379
> export OST_REDIS_PASS=st123
> export OST_REDIS_TLS_ENABLED=0
> export OST_MEMCACHE_SERVERS='127.0.0.1:11211'
> export OPENST_PLATFORM_PATH=$(pwd)/node_modules/@openstfoundation/openst-platform
> echo "export OPENST_PLATFORM_PATH=$(pwd)/node_modules/@openstfoundation/openst-platform" >> ~/.bash_profile
> node tools/setup/platform/deploy.js
```

* Enable Redis for platform
```bash
> vim $HOME/openst-setup/openst_env_vars.sh
export OST_CACHING_ENGINE='redis'
export OST_DEFAULT_TTL='36000'
export OST_REDIS_HOST='127.0.0.1'
export OST_REDIS_PORT=6379
export OST_REDIS_PASS=st123
export OST_REDIS_TLS_ENABLED=0
```

* Enable memcached for SAAS
```bash
> vim $HOME/openst-setup/openst_env_vars.sh
export OST_MEMCACHE_SERVERS='127.0.0.1:11211'
```

* Enable RabbitMQ for platform
```bash
> vim $HOME/openst-setup/openst_env_vars.sh
export OST_RMQ_SUPPORT='1'
export OST_RMQ_HOST='127.0.0.1'
export OST_RMQ_PORT='5672'
export OST_RMQ_USERNAME='guest'
export OST_RMQ_PASSWORD='guest'
export OST_RMQ_HEARTBEATS='30'
```

* Start Utility Chain
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> sh $HOME/openst-setup/bin/run-utility.sh
```

* Setup Price Oracle
```bash
> vim $HOME/openst-setup/openst_env_vars.sh
export OST_UTILITY_PRICE_ORACLES='{}'

> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node tools/setup/price-oracle/deploy.js

> vim $HOME/openst-setup/openst_env_vars.sh
# 3rd party contract address
export OST_UTILITY_PRICE_ORACLES='{"OST":{"USD":"0x51E7D0eC231c25D16bC3d949C9AEE8772B7f2332"}}'
```

* Setup Workers Contract
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node tools/setup/payments/set_worker.js

> vim $HOME/openst-setup/openst_env_vars.sh
# 3rd party contract address
export OST_UTILITY_WORKERS_CONTRACT_ADDRESS='0xFc036D20ee2134aC5DC688410D6684Ceec948962'
```

* Run openST Payments migrations
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
NOTE: Manually create data MySQL mentioned in $OP_MYSQL_DATABASE 
> node node_modules/@openstfoundation/openst-payments/migrations/create_tables.js
```

# Start SAAS Services

* Start redis
```bash
> sudo redis-server --port 6379  --requirepass 'st123'
```

* Start memcached
```bash
> memcached -p 11211 -d
```bash

* Start RMQ for platform (RMQ in browser: http://127.0.0.1:15672)
```bash
> brew services start rabbitmq
```bash

* Start MySQL
```bash
> mysql.server start
```

* Start value chain in new terminal
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> sh $HOME/openst-setup/bin/run-value.sh
```
  
* Start utility chain in new terminal
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> sh $HOME/openst-setup/bin/run-utility.sh
```

* Start Register Branded Token Intercom in new terminal
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node executables/inter_comm/register_branded_token.js $HOME/openst-setup/logs/register_branded_token.data
```

* Start Stake & Mint Intercom in new terminal
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node executables/inter_comm/stake_and_mint.js $HOME/openst-setup/logs/stake_and_mint.data
```

* Start Stake & Mint Processor Intercom in new terminal
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node executables/inter_comm/stake_and_mint_processor.js $HOME/openst-setup/logs/stake_and_mint_processor.data
```
  
* Start Airdrop Processor in new terminal
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node executables/rmq_subscribers/start_airdrop.js $HOME/openst-setup/logs/start_airdrop.data
```

* Start Processor to execute transactions in new terminal
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node executables/rmq_subscribers/execute_transaction.js $HOME/openst-setup/logs/execute_transaction.data
```

* Start APIs in new terminal
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node app.js
```

* Start Cronjobs
```base
# Every hour
node executables/update_price_oracle_price_points.js >> log/update_price_oracle_price_points.log
# Every five minutes
node executables/rmq_subscribers/send_error_emails.js >> log/send_error_emails.log
# Every minute
node executables/rmq_subscribers/start_airdrop.js >> log/start_airdrop.log
# Every five minutes
node executables/fund_addresses/by_reserve/st_prime.js >> log/fund_addresses/by_reserve/st_prime.log
# Every five minutes
node executables/fund_addresses/by_utility_chain_owner/eth.js >> log/fund_addresses_by_utility_chain_owner/eth.log
# Every five minutes
node executables/fund_addresses/by_utility_chain_owner/st_prime.js >> log/fund_addresses_by_utility_chain_owner/st_prime.log
# Every five minutes
node executables/fund_addresses/observe_balance_of_donors.js >> log/observe_balance_of_donors.log
```

# Helper Scripts

* Filling up missing nonce
```
c = require('./fire_brigade/fill_up_missing_nonce');
o = new c({from_address: '0x6bEeE57355885BAd8018814A0B0E93F368148c37', to_address: '0x180bA8f73897C0CB26d76265fC7868cfd936E617', chain_kind: 'value', missing_nonce: 25})
o.perform();
```