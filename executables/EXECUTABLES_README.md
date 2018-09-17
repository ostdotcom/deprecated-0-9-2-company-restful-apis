### Block scanner
This is a continuous cron, which does transaction status change and balance settlement in dynamo db. For further information, refer [here](../executables/block_scanner/for_tx_status_and_balance_sync.js)

### Fund addresses 
##### By reserve for ST Prime
This is a periodic cron which funds SP Prime to required addresses from company reserve address. For further information, refer [here](../executables/fund_addresses/by_reserve/st_prime.js)


##### By utility chain owner for Eth
This is a periodic cron which funds Eth to required addresses from utility chain owner. For further information, refer [here](../executables/fund_addresses/by_utility_chain_owner/eth.js)

##### By utility chain owner for ST Prime
This is a periodic cron which funds SP Prime to required addresses from utility chain owner. For further information, refer [here](../executables/fund_addresses/by_utility_chain_owner/st_prime.js)

##### Observe balance of donors
This is a periodic cron which observes the balance of donors. For further information, refer [here](../executables/fund_addresses/observe_balance_of_donors.js)

### Inter-comm

##### Register branded token intercomm
This is a continuous cron, which registers the branded token on value and utility chains, For more info, refer [here](../executables/inter_comm/register_branded_token.js)

##### Stake and mint intercomm
This is a continuous cron, which stakes OST on value chain, For more info, refer [here](../executables/inter_comm/stake_and_mint.js)

##### Stake and mint processor intercomm
This is a continuous cron, which mints branded tokens on utility chain, For more info, refer [here](../executables/inter_comm/stake_and_mint_processor.js)

##### Stake hunter intercomm
This is a continuous cron, triggers process staking if not triggered already. For more info, refer [here](../executables/inter_comm/stake_hunter.js)

### RMQ Subscribers

##### Execute transaction
This is a continuous cron, which triggers send transaction to geth. For more info, refer [here](../executables/rmq_subscribers/execute_transaction.js)

##### Factory
This is a continuous cron, which is a factory for all rabbitmq subscribers. For more info, refer [here](../executables/rmq_subscribers/factory.js)

##### Send error emails
This is a periodic cron , which accumulates any error notifications to be sent and delivers them. For more info, refer [here](../executables/rmq_subscribers/send_error_emails.js)

##### Start airdrop
This is a continuous cron, which listens to start airdrop event and triggers airdrop to users. For more info, refer [here](../executables/rmq_subscribers/start_airdrop.js)

### Add more workers
This is an on-demand executable, which adds workers to given list of clients. For more info, refer [here](../executables/add_more_workers.js)

### Block chain metrics
This is an on-demand executable, which provides the no of transactions that are submitted, successful, failed in a range of blocks. For more info, refer [here](../executables/blockchain_metrics_script.js)

### Check balances
This is an on-demand executable, which checks compares balances from DDB and Chain for given clients. For more info, refer [here](../executables/check_balances.js)

### Create initial shards
This is an setup time only script, which helps in creating initial shards. Fore more info, refer [here](../executables/create_init_shards.js)

### Create shard
This is an on-demand executable, which creates a shard and adds them to config strategy. For more info, refer [here](../executables/create_shard.js)

### Sync Dynamo balance with chain
This is an on-demand executable, which helps in clearing messed up balances in dynamo to sync with on-chain balances. For more info, refer [here](../executables/sync_ddb_balance_with_chain.js)

### Update price points
This is a periodic cron, which updates price points to latest. For more info, refer [here](../executables/update_price_oracle_price_points.js)

### Update real time gas price
This is a periodic cron, which sets various gas prices in cache after getting the values from dynamic gas price repo. For more info, refer [here](../executables/update_realtime_gas_price.js)

### Fire brigade

##### Clean nonce cache 
This is an on-demand executable, which clears up nonce cache for a particular address. For more info refer [here](../executables/fire_brigade/clear_nonce_cache.js)

##### Fill up missing nonce
This is an on-demand executable, which fills up missing nonce by triggering dummy transactions for an address. For more info refer [here](../executables/fire_brigade/fill_up_missing_nonce.js)

##### Fill up missing nonce range 
This is an on-demand executable, which fills up missing nonce over range of geth providers. For more info refer [here](../executables/fire_brigade/fill_up_missing_nonce_range.js)


