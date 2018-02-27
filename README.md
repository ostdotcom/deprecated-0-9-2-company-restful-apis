# Pre Setup

* Install required packages
```bash
> npm install
```

* Setup Platform
```bash
> cd company-restful-apis
> export OPENST_PLATFORM_PATH=$(pwd)/node_modules/@openstfoundation/openst-platform
> node $OPENST_PLATFORM_PATH/tools/setup/index.js
```

* Enable memcached for platform
```bash
> vim $HOME/openst-setup/openst_env_vars.sh
export OST_CACHING_ENGINE='memcached'
export OST_MEMCACHE_SERVERS='127.0.0.1:11211'
```

* Enable RMQ for platform
```bash

# Start rabbmitMQ 
> brew services start rabbitmq

# RMQ in browser
http://127.0.0.1:15672

# Configure environment variables 
> vim $HOME/openst-setup/openst_env_vars.sh

export OST_RMQ_SUPPORT='1'
export OST_RMQ_HOST='127.0.0.1'
export OST_RMQ_PORT='5672'
export OST_RMQ_USERNAME='guest'
export OST_RMQ_PASSWORD='guest'
export OST_RMQ_HEARTBEATS='30'
```

* Setup Price Oracle
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> export OPENST_PLATFORM_PATH=$(pwd)/node_modules/@openstfoundation/openst-platform
> node $OPENST_PLATFORM_PATH/tools/setup/start_services.js


> vim $HOME/openst-setup/openst_env_vars.sh
export OST_UTILITY_PRICE_ORACLES='{}'

> source $HOME/openst-setup/openst_env_vars.sh
> node node_modules/@ostdotcom/ost-price-oracle/tools/deploy/price_oracle.js OST USD $OST_UTILITY_GAS_PRICE

> vim $HOME/openst-setup/openst_env_vars.sh
# 3rd party contract address
export OST_UTILITY_PRICE_ORACLES='{"OST":{"USD":"0x60Fa2655AD1F08DfC3e1DAd9b31e4DD817a36f9D"}}'
```

* Setup Workers Contract
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> export OPENST_PLATFORM_PATH=$(pwd)/node_modules/@openstfoundation/openst-platform
> node $OPENST_PLATFORM_PATH/tools/setup/start_services.js


> node node_modules/@openstfoundation/openst-payments/tools/deploy/workers.js $OST_UTILITY_GAS_PRICE $OST_UTILITY_CHAIN_ID

> vim $HOME/openst-setup/openst_env_vars.sh
# 3rd party contract address
export OST_UTILITY_WORKERS_CONTRACT_ADDRESS='0x549B7A418f88F02cF366E4999bda858BB8815451'
```

* Run openST Payments migrations
```bash
> source $HOME/openst-setup/openst_env_vars.sh
> export OPENST_PLATFORM_PATH=$(pwd)/node_modules/@openstfoundation/openst-platform
> source set_env_vars.sh
NOTE: Manually create data MySQL mentioned in $OP_MYSQL_DATABASE 
> node node_modules/@openstfoundation/openst-payments/migrations/create_tables.js
```

# Start Services

* Start Platform
  * For just utility chain interaction
  ```bash
  > cd company-restful-apis
  > source $HOME/openst-setup/openst_env_vars.sh
  > export OPENST_PLATFORM_PATH=$(pwd)/node_modules/@openstfoundation/openst-platform
  > sh $HOME/openst-setup/bin/run-utility.sh
  ```

  * For both chain interactions
  ```bash
  > cd company-restful-apis
  > source $HOME/openst-setup/openst_env_vars.sh
  > export OPENST_PLATFORM_PATH=$(pwd)/node_modules/@openstfoundation/openst-platform
  > node $OPENST_PLATFORM_PATH/tools/setup/start_services.js
  ```
  
* Start APIs
```bash
> cd company-restful-apis
> source $HOME/openst-setup/openst_env_vars.sh
> source set_env_vars.sh
> node app.js
```

* Start Cronjobs
```base
*/60 * * * * node executables/update_price_oracle_price_points.js >> logs/update_price_oracle_price_points.log
*/5 * * * * node executables/rmq_subscribers/send_error_emails.js >> logs/send_error_emails.log
*/5 * * * * node executables/generate_managed_addresses.js >> logs/generate_managed_addresses.log
```
