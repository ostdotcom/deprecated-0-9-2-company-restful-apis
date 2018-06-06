1. Create tables needed for DDB framework

``` node.js
node executables/ddb_related_data_migrations/create_init_ddb_tables.js
```

2. Create a fixed number of shards for all entities (number is in this file)

``` node.js
node executables/ddb_related_data_migrations/create_shards.js
```

3. Manually setup point in time recovery for all tables

4. Manually enable streams for tx_tables

5. For existing clients assign shards for all relavant entities

``` node.js
node executables/ddb_related_data_migrations/assign_dynamoDB_shards.js
```

6. Migrate token balances & transaction_logs data (for type = 1 and those who made it to a block) to DDB table (start and end block number to be passed as params in the below command)

``` node.js
node executables/ddb_related_data_migrations/migrate_data_from_chain_to_ddb.js startBlock endBlock
```

7. Migrate transaction log data (for transactions which didn't made it to a block and type != 1) to DDB table (start and end id to be passed as params in the below command)
   
``` node.js
nohup node executables/ddb_related_data_migrations/migrate_remaining_transaction_logs_data.js 1 1200
```

8. Script to check balances in DDB table are in sync with those on chain

``` node.js
nohup node executables/ddb_related_data_migrations/check_balances.js
```
