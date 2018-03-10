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
export OST_UTILITY_PRICE_ORACLES='{"OST":{"USD":"0x60Fa2655AD1F08DfC3e1DAd9b31e4DD817a36f9D"}}'
```

* Setup Workers Contract
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> node tools/setup/payments/set_worker.js

> vim $HOME/openst-setup/openst_env_vars.sh
# 3rd party contract address
export OST_UTILITY_WORKERS_CONTRACT_ADDRESS='0x549B7A418f88F02cF366E4999bda858BB8815451'
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
> executables/inter_comm/register_branded_token.js
```

* Start Stake & Mint Intercom in new terminal
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> executables/inter_comm/stake_and_mint.js
```

* Start Stake & Mint Processor Intercom in new terminal
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> executables/inter_comm/stake_and_mint_processor.js
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
```
