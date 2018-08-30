# Core ENV Details
export CR_ENVIRONMENT='development'
export CR_SUB_ENVIRONMENT='sandbox'

# chain constants
export OST_VALUE_GETH_RPC_PROVIDERS='["http://127.0.0.1:8545"]'
export OST_VALUE_GETH_WS_PROVIDERS='["ws://127.0.0.1:18545"]'

export OST_UTILITY_GETH_RPC_PROVIDERS='["http://127.0.0.1:9546"]'
export OST_UTILITY_GETH_WS_PROVIDERS='["ws://127.0.0.1:19546"]'

# Cache Engine
export CR_ONLY_CACHE_ENGINE='memcached'

#cache engine for openst storage. Presently used for token balance cache.
export OS_CACHING_ENGINE='memcached'

# Database details
export CR_MYSQL_CONNECTION_POOL_SIZE='3'

export CR_DEFAULT_MYSQL_HOST='127.0.0.1'
export CR_DEFAULT_MYSQL_USER='root'
export CR_DEFAULT_MYSQL_PASSWORD='root'

export CR_ECONOMY_DB_MYSQL_HOST='127.0.0.1'
export CR_ECONOMY_DB_MYSQL_USER='root'
export CR_ECONOMY_DB_MYSQL_PASSWORD='root'

export CR_TRANSACTION_DB_MYSQL_HOST='127.0.0.1'
export CR_TRANSACTION_DB_MYSQL_USER='root'
export CR_TRANSACTION_DB_MYSQL_PASSWORD='root'

export CR_CA_SHARED_MYSQL_HOST='127.0.0.1'
export CR_CA_SHARED_MYSQL_USER='root'
export CR_CA_SHARED_MYSQL_PASSWORD='root'

# DB details of openst-payments.
export OP_MYSQL_HOST='127.0.0.1'
export OP_MYSQL_USER='root'
export OP_MYSQL_PASSWORD='root'
export OP_MYSQL_DATABASE=openst_payments_${CR_SUB_ENVIRONMENT}_${CR_ENVIRONMENT}
export OP_MYSQL_CONNECTION_POOL_SIZE='5'

# Constants for openst-storage
export OS_DYNAMODB_API_VERSION='2012-08-10'
export OS_DYNAMODB_ACCESS_KEY_ID='x'
export OS_DYNAMODB_SECRET_ACCESS_KEY='x'
export OS_DYNAMODB_REGION='localhost'
export OS_DYNAMODB_ENDPOINT='http://localhost:8000'
export OS_DYNAMODB_SSL_ENABLED='0'
export OS_DYNAMODB_LOGGING_ENABLED='0'
export OS_AUTOSCALING_API_VERSION='2016-02-06'
export OS_AUTOSCALING_ACCESS_KEY_ID='x'
export OS_AUTOSCALING_SECRET_ACCESS_KEY='x'
export OS_AUTOSCALING_REGION='localhost'
export OS_AUTOSCALING_ENDPOINT='http://localhost:8000'
export OS_AUTOSCALING_SSL_ENABLED='0'
export OS_AUTOSCALING_LOGGING_ENABLED='0'
export OS_DYNAMODB_TABLE_NAME_PREFIX='d_pk_'

# AWS details
export CR_AWS_ACCESS_KEY='AKIAJUDRALNURKAVS5IQ'
export CR_AWS_SECRET_KEY='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'
export CR_AWS_REGION='us-east-1'

# KMS details
export CR_API_KEY_KMS_ARN='arn:aws:kms:us-east-1:604850698061:key'
export CR_API_KEY_KMS_ID='eab8148d-fd9f-451d-9eb9-16c115645635'
export CR_MANAGED_ADDRESS_KMS_ARN='arn:aws:kms:us-east-1:604850698061:key'
export CR_MANAGED_ADDRESS_KMS_ID='eab8148d-fd9f-451d-9eb9-16c115645635'

# JWT details
export CA_SAAS_API_SECRET_KEY='1somethingsarebetterkeptinenvironemntvariables'

# SHA256 details
export CA_GENERIC_SHA_KEY='9fa6baa9f1ab7a805b80721b65d34964170b1494'
export CR_CACHE_DATA_SHA_KEY='066f7e6e833db143afee3dbafc888bcf'
export OST_STANDALONE_MODE='0'

export CR_ACCEPTED_PRICE_FLUCTUATION_FOR_PAYMENT='{"OST":{"USD": "1000000000000000000"}}'

# Elastic Search details
export CR_ES_HOST='http://localhost:9200'

export OST_WEB3_POOL_SIZE=10

#Mainnet
export MIN_VALUE_GAS_PRICE='0xBA43B7400';
export MAX_VALUE_GAS_PRICE='0x174876E800';
export DEFAULT_VALUE_GAS_PRICE='0x1176592E00';
export BUFFER_VALUE_GAS_PRICE='0xBA43B7400';
export ENV_IDENTIFIER='mainnet_launch';
