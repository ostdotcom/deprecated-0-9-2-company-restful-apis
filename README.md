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

* Setup Price Oracle
```bash
> node node_modules/@ostdotcom/ost-price-oracle/tools/deploy/price_oracle.js OST USD $OST_UTILITY_GAS_PRICE
> vim $HOME/openst-setup/openst_env_vars.sh
# 3rd party contract address
OST_UTILITY_PRICE_ORACLES='{"OST":{"USD":"------------ NEW CONTRACT ADDRESS JUST DEPLOYED ------------"}}'
> node executables/update_price_oracle_price_points.js
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
```
