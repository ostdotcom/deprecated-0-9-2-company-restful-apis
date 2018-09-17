1. Create a fixed number of shards for all entities (number is in this file)

``` node.js
node executables/ddb_related_data_migrations/create_init_shards.js $CONFIG_STRATEGY_PATH
```

2. Manually setup point in time recovery for all tables

3. Manually enable streams for tx_tables

4. For existing clients assign shards for all relavant entities

``` node.js
node executables/ddb_related_data_migrations/assign_dynamoDB_shards.js
```

[test link](create_init_shards.js)
[test link2](../../executables/es_related/benchmark_select_queries.js)

5. Migrate token balances & transaction_logs data (for type = 1 and those who made it to a block) to DDB table (start and end block number to be passed as params in the below command)

``` node.js
nohup node executables/ddb_related_data_migrations/migrate_data_from_chain_to_ddb.js startBlock endBlock &> nohup2.out&
```

6. Migrate transaction log data (for transactions which didn't made it to a block and type != 1) to DDB table (start and end id to be passed as params in the below command)
   
``` node.js
nohup node executables/ddb_related_data_migrations/migrate_remaining_transaction_logs_data.js 1 335400 &
```

7. Script to check balances in DDB table are in sync with those on chain

``` node.js
node executables/ddb_related_data_migrations/check_balances.js
```

8. For data already populated in transaction_logs DDB, add airdrop_amount_in_wei to it 

``` node.js
nohup node executables/ddb_related_data_migrations/add_airdrop_amount_to_existing_ddb_data.js shardName &> nohup3.out&
```

9. For data already populated in token balances DDB, add pessimistic_balance to it 

``` node.js
nohup node executables/ddb_related_data_migrations/add_pessimistic_settled_balance_to_existing_ddb_data.js shardName &> nohup4.out&
```
