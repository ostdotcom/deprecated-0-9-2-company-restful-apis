# Core ENV Details
export CR_ENVIRONMENT='development'
export CR_SUB_ENVIRONMENT='sandbox'

# Database details
export CR_MYSQL_HOST='127.0.0.1'
export CR_MYSQL_USER='root'
export CR_MYSQL_PASSWORD='root'
export CR_MYSQL_CONNECTION_POOL_SIZE='5'

#DB details of openst-payments.
export OP_MYSQL_HOST='127.0.0.1'
export OP_MYSQL_USER='root'
export OP_MYSQL_PASSWORD=''
export OP_MYSQL_DATABASE=payment_${CR_SUB_ENVIRONMENT}_${CR_ENVIRONMENT}
export OP_MYSQL_CONNECTION_POOL_SIZE='5'

# AWS details
export CR_AWS_ACCESS_KEY='AKIAJUDRALNURKAVS5IQ'
export CR_AWS_SECRET_KEY='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'
export CR_AWS_REGION='us-east-1'

# KMS details
export CR_INFO_KMS_ARN='arn:aws:kms:us-east-1:604850698061:key'
export CR_INFO_KMS_ID='eab8148d-fd9f-451d-9eb9-16c115645635'

# JWT details
export CA_SAAS_API_SECRET_KEY='1somethingsarebetterkeptinenvironemntvariables'

# SHA256 details
export CA_GENERIC_SHA_KEY='9fa6baa9f1ab7a805b80721b65d34964170b1494'
export CR_CACHE_DATA_SHA_KEY='066f7e6e833db143afee3dbafc888bcf'

export CR_ACCEPTED_PRICE_FLUCTUATION_FOR_PAYMENT='{"OST":{"USD": "1000000000000000000"}}'