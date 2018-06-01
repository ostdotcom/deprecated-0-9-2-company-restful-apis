1. Create tables needed for DDB framework

``` node.js
node executables/ddb_related_data_migrations/create_init_ddb_tables.js
```

2. Create a fixed number of shards for all entities (number is in this file)

``` node.js
node executables/ddb_related_data_migrations/create_shards.js
```

3. For existing clients assign shards for all relavant entities

``` node.js
node executables/ddb_related_data_migrations/assign_dynamoDB_shards.js
```

4. Migrate token balances data to DDB table (start and end block number to be passed as params in the below command)

``` node.js
nohup node executables/ddb_related_data_migrations/migrate_data_from_chain_to_ddb.js 1 100
```

5. Migrate transaction log data to DDB table (start and end id to be passed as params in the below command)
   
``` node.js
nohup node executables/ddb_related_data_migrations/migrate_remaining_transaction_logs_data.js 1 100
```

