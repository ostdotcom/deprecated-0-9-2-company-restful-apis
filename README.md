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
> source set_env_vars.sh
> node app.js
```