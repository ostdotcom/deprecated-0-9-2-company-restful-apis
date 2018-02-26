---
id: transaction
title:Transaction API
sidebar_label:Transaction API 
---

Transactions are executed when tokens are moved between accounts. These can be between _user_ to another _user_ or _company_ to _user_ and vice versa. In ostKIT a transaction represents a core action or event in your application, as examples, a "like", "share", "purchase", "monthly winner" or a "birthday event". You can associate a value with each transaction. Once you create such transactions for your application and assign value to each of them, they become opportunities for your end-users to "Earn" and "Spend" Branded Tokens (BT) in your application. This exchange of tokens represents a branded token economy.

So an important aspect of setting up a branded token economy is to setup transactions. Below we detail out APIs for creating transactions, running them and viewing the list of all transactions created. 


#### Transaction Object  
| Parameter           | Type   | Description                                                                                                                                       |
|---------------------|--------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| _name_                | String | String representing the name of the transaction. (example :an "Upvote","buy a coffee")                                                                                                                                                                                   |
| _kind_ <br>([show sub-attributes](http://localhost:3000/test-site/docs/transaction.html#transaction-kind-properties))                | String | String representing the type of transaction, differentiated based on the owners involved in the token exchange. The three types of transactions are **_user_to_user_**, **_company_to_user_** and **_user_to_company_**.                                                                                                                                                       |
| _value_currency_type_ <br>([show sub-attributes](http://localhost:3000/test-site/docs/transaction.html#transaction-value-currency-type-properties))| String | String representing the currency type in which the value of the transaction has been set. The transaction value can either be set in USD or in Branded Tokens (BT). Example: you can set value of an "Upvote" transaction to be 20 cents or 10 of your branded tokens. If the value is set in USD, the string used should be **_usd_** and if the value is set in branded tokens the string used should be **_bt_** .                                                                                                                                                        |
| _value_in_bt_         | Float  | Amount in branded tokens (BT) to be set as transaction value.                                                                                                                                                                                                                |
| _commission_percent_  | Float  | You as a company can set a fee on **_user_to_user_** transactions. Example: If a user buys a service on your platform from another user, you can set a fee on these 'buy' transactions.  This fee is set in percentage of the total value of the transaction and is not additional to the transaction value. |
| _value_in_usd_        | Float  | Amount in dollars (USD) to be set as transaction value.                                                                                                                                                                                                            |

#### Transaction - _kind_ properties 
| Parameter       | Type   | Definition                                                                                    |
|-----------------|--------|-----------------------------------------------------------------------------------------------|
| _user_to_user_    | String | Value transfer from one end-user to another. Example: "Upvote" or "like".                                         |
| _user_to_company_ | String | Value transfer from an end-user to you (the application service provider). Example: “API call”. |
| _company_to_user_ | String | Value transfer from the application service provider to an end-user. Example: “Rewards”.    |

#### Transaction - _value_currency_type_ properties 
| Parameter | Type   | Definition                                                                                                        |
|-----------|--------|-------------------------------------------------------------------------------------------------------------------|
| _usd_       | String | Fiat currency that the transaction is valued in.                                                                |
| _bt_        | String | Branded tokens that the transaction is valued in.  |


### 1. Create a new transaction API
Creating transaction requires evaluating core user actions on your application and filtering out for the ones that you want to trigger branded token exchanges. Once you have decided the core actions you should start with creating a transaction for each of them. While setting up these transactions you should decide the type of the transaction, associate a value to it and also (if required) set a commission on it. An “Upvote” for example would be setup as a **_user-to-user_** transaction, whereas something like “Rewards”  would be setup as a **_company-to-user_** transaction. The value for a transaction can be set in two ways. One in the fiat value system : USD - US dollars and second in the tokenized value system : BT - your branded token.

#### POST 
```url
{{saas_api_url}}/transaction/kind/create
```

#### Parameters 
| Parameter           | Type   | Value                                               |
|---------------------|--------|-----------------------------------------------------|
| _name_                | String | String representing name of the transaction. Example :"Upvote","buy a coffee".                               |
| _kind_                | String | The type of transaction based on the owners involved in the token exchange. Example **_user_to_user_** .                  |
| _value_currency_type_ | String | String representing the currency the transaction is valued in. Two possible values **_usd_** or **_bt_** .                                 |
| _value_in_bt_         | Float  | Positive number that represents amount of branded token to be set as transaction value.                 |
| _commission_percent_  | Float  | % of transaction value that you set as a service provider on a transaction. Can be set for only **_user_to_user_** transaction type. |
| _value_in_usd_        | Float  | Positive number that represents amount in dollars (USD) to be set as transaction value.               |


#### Sample Code | Curl 
```bash
curl --request POST \
  --url 'http://{{saas_api_url}}/transaction/kind/create' \
  --header 'content-type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW' \
  --form name=ABC \
  --form kind=user_to_user \
  --form value_currency_type=usd \
  --form value_in_bt=1 \
  --form commission_percent=10 \
  --form value_in_usd=1
```

#### Returns
Returns a transaction object if there were no initial errors with the transaction creation. Example - transactions being created with duplicate names, or value of the transaction set breaches the max value set. This call will return an error if create parameters are invalid. Errors are sent as per specification [here.](http://localhost:3000/test-site/docs/error.html)

#### Response
```javascript
{"client_id"=>28, "result_type"=>"transaction_types", 
"transaction_types"=> [ {"id"=>"5","name"=>"Transaction 4", 
"kind"=>"company_to_user", "currency_type"=>"bt", 
"currency_value"=>"0.5", "commission_percent"=>"0.000", 
"status"=>"active"}], "meta"=>{"next_page_payload"=>{}},
"price_points"=>{"ost"=>{"usd"=>"1"}}, "client_tokens"=> 
[{"id"=>"16", "client_id"=>28, "reserve_managed_address_id"=>90, 
"name"=>"sd1", "symbol"=>"sd1", "symbol_icon"=>nil,
"token_erc20_address"=>"0xdc1A2F9A712a38F673fe7758C35Bec4F9051Da63", 
"token_uuid"=> "0xf4842e7905d55ebd6699832662570539c2995d35e345360a4cf05e9b486e0a95",
"conversion_rate"=>"1.000000", "created_at"=>"2018-02-20 08:16:27",
"updated_at"=>"2018-02-20 08:31:44"}]}

```

### 2. Update an existing transaction API
Updates the specified transaction by setting the values of the parameters passed. Any parameter not provided will be left unchanged. Individual keys can be unset by posting an empty value to them. 

#### POST 
```url
{{saas_api_url}}/transaction/kind/edit
```

#### Parameters 
| Parameter             | Type   | Value                                                                                              |
|-----------------------|--------|----------------------------------------------------------------------------------------------------|
| _client_transaction_id_ | String | The ID of the transaction that was returned when the transaction was created with the [create transaction API](http://localhost:3000/test-site/docs/transaction.html#1-create-a-new-transaction-api) |
| _kind_                  | String | The type of transaction based on the owners involved in the token exchange. Example **_user_to_user_**                                                                    |
| _value_currency_type_   | String | String representing the currency the transaction is valued in. Two possible values are **_usd_** or **_bt _.**                                                                               |
| _value_in_bt_           | Float  | Positive number that represents amount of Branded Token to be set as transaction value.                                                                   |
| _commission_percent_    | Float  | Percentage of the total transaction value that you set as a service provider on a transaction. Can be set for only user_to_user transaction type.                                                |
| _value_in_usd_          | Float  | positive number that represents amount in dollars (USD) to be set as transaction value.                                                                  |

#### Sample Code | Curl 
```bash
curl --request POST \
  --url 'http://{{saas_api_url}}/transaction/kind/edit' \
  --header 'content-type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW' \
  --form client_transaction_id=13 \
  --form kind=user_to_user \
  --form value_currency_type=usd \
  --form value_in_bt=1 \
  --form commission_percent=10 \
  --form value_in_usd=1
```

#### Returns
Returns a transaction object if the update is successful. This call will return an error if update parameters are invalid. Errors are sent as per specification here <cross link to Error Handling>

#### Response
```javascript
{"client_id"=>28, "result_type"=>"transaction_types", 
"transaction_types"=> [ {"id"=>"5", "name"=>"Transaction 4", 
"kind"=>"company_to_user", "currency_type"=>"bt", 
"currency_value"=>"0.5", "commission_percent"=>"0.000", 
"status"=>"active"}], "meta"=>{"next_page_payload"=>{}}, 
"price_points"=>{"ost"=>{"usd"=>"1"}}, "client_tokens"=> 
[{"id"=>"16", "client_id"=>28, "reserve_managed_address_id"=>90, 
"name"=>"sd1", "symbol"=>"sd1", "symbol_icon"=>nil, 
"token_erc20_address"=>"0xdc1A2F9A712a38F673fe7758C35Bec4F9051Da63", 
"token_uuid"=> "0xf4842e7905d55ebd6699832662570539c2995d35e345360a4cf05e9b486e0a95", 
"conversion_rate"=>"1.000000", "created_at"=>"2018-02-20 08:16:27", 
"updated_at"=>"2018-02-20 08:31:44"}]}
```

### 3. List all existing transactions API

Returns a list of all existing transactions created. The transactions are returned in creation order, with the transcations created first, appearing at the top. 


#### GET 
```url
{{saas_api_url}}/transaction/kind/get-all?page_no=1
```
  
#### Parameters 
| Parameter | Type | Value                                         |
|-----------|------|-----------------------------------------------|
| _page_no_   | Int  | 1 (page number for all the transaction types) |

#### Sample Code | Curl 
```bash
curl --request POST \
  --url 'http://{{saas_api_url}}/transaction/kind/create' \
  --header 'content-type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW' \
  --form name=ABC \
  --form kind=user_to_user \
  --form value_currency_type=usd \
  --form value_in_bt=1 \
  --form commission_percent=10 \
  --form value_in_usd=1
```

#### Returns
Returns a hash with a key _result-type_. The value of _result-type_ is in-turn a key _transaction_type_. This key _transaction_type_ is an array of upto 25 transactions. Each entry in the array is a separate transaction object. If there are subsequent transactions the resulting hash in the response will come with the a meta parameter _next_page_payload_ as shown below. 

```javascript
"meta"=>{"next_page_payload"=>{"page_no"=>2}}
```

If no more transactions are available, the resulting hash will have the meta parameter with an empty value of next_page_payload.


#### Response
```javascript
{"client_id"=>28, "result_type"=>"transaction_types", 
"transaction_types"=> [{"id"=>"4", "name"=>"Transaction 1", 
"kind"=>"user_to_user", "currency_type"=>"bt", "currency_value"=>"10"
, "commission_percent"=>"0.000", "status"=>"active"}, 
{"id"=>"2", "name"=>"Transaction 2", "kind"=>"company_to_user", 
"currency_type"=>"usd", "currency_value"=>"1.000000", 
"commission_percent"=>"10.000", "status"=>"active"}, 
{"id"=>"3", "name"=>"Transaction 3", "kind"=>"user_to_company", 
"currency_type"=>"usd", "currency_value"=>"0.500000", 
"commission_percent"=>"10.000", "status"=>"active"}, 
{"id"=>"5", "name"=>"Transaction 4", "kind"=>"company_to_user", 
"currency_type"=>"bt", "currency_value"=>"0.5", 
"commission_percent"=>"0.000", "status"=>"active"}], 
"meta"=>{"next_page_payload"=>{}}, 
"price_points"=>{"ost"=>{"usd"=>"1"}}, "client_tokens"=> 
[{"id"=>"16", "client_id"=>28, "reserve_managed_address_id"=>90, 
"name"=>"sd1", "symbol"=>"sd1", "symbol_icon"=>nil, 
"token_erc20_address"=>"0xdc1A2F9A712a38F673fe7758C35Bec4F9051Da63", 
"token_uuid"=> "0xf4842e7905d55ebd6699832662570539c2995d35e345360a4cf05e9b486e0a95", 
"conversion_rate"=>"1.000000", "created_at"=>"2018-02-20 08:16:27", 
"updated_at"=>"2018-02-20 08:31:44"}]}
```


