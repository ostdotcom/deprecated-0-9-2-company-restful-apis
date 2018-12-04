
1. INSERT config strategy in db

>> node chain_setup.js -c <path to config.json> -g <chain id>

2. FUND addresses with eth you will get addresses from above command

 Ex: Address to be funded: {"OST_UTILITY_CHAIN_OWNER_ADDR":"0x141618ca348A0607e869083038b21c92a3AE9261","OST_FOUNDATION_ADDR":"0x9760B61B2C9948d5A588FdFb308B6afD55515FD7"}

3. FUND addresses script to fund the other addresses
>> node executables/fund_addresses/by_utility_chain_owner/eth.js <chain id> true

4. Flush memcache and run value chain deployment
>> node devops/flush_memcache.js

5. Run Value chain deployment
>> node chain_setup.js -v

6. Run Utility chain deployment
>> node chain_setup.js -u -g <chain id>