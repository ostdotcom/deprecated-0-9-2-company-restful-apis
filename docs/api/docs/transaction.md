---
id: transaction
title:Transaction API
sidebar_label:Transaction API 
---

 Transactions are defined post onboarding users into your application with tokenization capability provided by ostKIT alpha. The _company_ needs to understand the tokenization capacity of the set of actions that the user engages with while using the services provided by the _company_'s application. An action that leads to a transaction of value between _user_ and _company_ or _user_ and another _user_ can be defined using this API. Thus tokenizing an aspect of the application - end-user interactivity with ostKIT alpha.  

| Parameter           | Type   | Description                                                                                                                                                                                                                                |
|---------------------|--------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| _name_                | String | The name / username of the end-user of your application.                                                                                                                                                                                   |
| [_kind_](http://localhost:3000/test-site/docs/transaction.html#transaction-kind-properties)                | String | The three kinds of transaction types _user_to_user_ or _user_to_company_ or _company_to_user_.                                                                                                                                                      |
| [_value_currency_type_](http://localhost:3000/test-site/docs/transaction.html#transaction-value-currency-type-properties)| String | The two types of currencies tokenization can utilize or be based on, _usd_ or _bt_.                                                                                                                                                        |
| _value_in_bt_         | Float  | Value of BT (Branded Token) of transaction. The value of BT to USD is defined during minting of BT.                                                                                                                                                                                                                 |
| _commission_percent_  | Float  | The commission (percentage) on the transaction value that the platform / service / application / _company_ deducts from the total value, for its revenue. Every action (_kind_) defined can have its own tweakable commission based on the value of the service provided to the end-user. |
| _value_in_usd_        | Float  | Value in USD of the transaction                                                                                                                                                                                                            |

#### Transaction - _kind_ properties 
| Parameter       | Type   | Definition                                                                                    |
|-----------------|--------|-----------------------------------------------------------------------------------------------|
| _user_to_user_    | String | Value transfer from one end-user to another. Eg: "Upvote" or "like" end-user                                          |
| _user_to_company_ | String | Value transfer from an end-user to the application service provider / _company_. Eg: “API call” |
| _company_to_user_ | String | Value transfer from the application service provider company to an end-user. Eg: “Rewards”    |

#### Transaction - _value_currency_type_ properties 
| Parameter | Type   | Definition                                                                                                        |
|-----------|--------|-------------------------------------------------------------------------------------------------------------------|
| _usd_       | String | Fiat currency that the Branded Token is valued in.                                                                |
| _bt_        | String | Branded Token created at the staked value of OST. Each BT has a fixed value in terms of USD when it is defined. |

### 1.Create a new transaction kind API
Creating transaction types requires an understanding of user actions on the services provided by the _company_'s application, that can trigger value transfers and value generation. An “Upvote” for example can be considered a user-to-user interactive value transfer, whereas something like “Rewards” constitutes a company-to-user interactive value transfer. For each _kind_ of transaction or user action, the base value of the action can be defined within two systems, namely the fiat value system : USD - US dollars and also naturally the tokenized value system : BT - Branded Token. 

For each such action converted into a transaction on blockchain by the ostKIT alpha, the choice of keeping the USD value of the transaction floating or fixed is upto the creator of the transaction type. The reason this choice is left to discretion of creator in the _company_, is because certain goods and services have a fixed real world cost associated with them, here a variable USD deductible cost would be inconvenient to base economic predictability. On the other hand certain other actions of the end-user in the _company_'s application can provide value that can have speculative real world value. This depends on the ubiquity and popularity of the application itself, hence a variable approach would be preferred.

#### POST 
```url
{{saas_api_url}}/transaction/kind/create
```

#### parameters 
| Parameter           | Type   | Value                                               |
|---------------------|--------|-----------------------------------------------------|
| name                | String | ABC (displayed name)                                |
| kind                | String | user_to_user (transaction type)                     |
| value_currency_type | String | usd (currency used)                                 |
| value_in_bt         | Float  | 1 (Branded Token Transaction Value)                 |
| commission_percent  | Float  | 10 (% of value awarded to the app service provider) |
| value_in_usd        | Float  | 1 (Fiat currency Transaction Value)                 |


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

#### Response
```javascript
{"client_id"=>28, "result_type"=>"transaction_types", "transaction_types"=> [ {"id"=>"5",
"name"=>"Transaction 4", "kind"=>"company_to_user", "currency_type"=>"bt", "currency_value"=>"0.5", "commission_percent"=>"0.000", "status"=>"active"}], "meta"=>{"next_page_payload"=>{}}, "price_points"=>{"ost"=>{"usd"=>"1"}}, "client_tokens"=> [{"id"=>"16", "client_id"=>28, "reserve_managed_address_id"=>90, "name"=>"sd1", "symbol"=>"sd1", "symbol_icon"=>nil, "token_erc20_address"=>"0xdc1A2F9A712a38F673fe7758C35Bec4F9051Da63", "token_uuid"=> "0xf4842e7905d55ebd6699832662570539c2995d35e345360a4cf05e9b486e0a95", "conversion_rate"=>"1.000000", "created_at"=>"2018-02-20 08:16:27", "updated_at"=>"2018-02-20 08:31:44"}]}

```

### 2.Edit an existing transaction kind API 
Post defining the different user actions that lead to transactions types, if the application service provider or _company_ would like to observe and edit the parameters of one of these transactions types, this API can be utilized. 

#### POST 
```url
{{saas_api_url}}/transaction/kind/edit
```

#### Parameters 
| Parameter             | Type   | Value                                                                                              |
|-----------------------|--------|----------------------------------------------------------------------------------------------------|
| client_transaction_id | String | 13 (id that was generated when the transaction type was created with the creatTransactionType API) |
| kind                  | String | user_to_user (transaction type)                                                                    |
| value_currency_type   | String | usd (currency used)                                                                                |
| value_in_bt           | Float  | 1 (Branded Token Transaction Value)                                                                |
| commission_percent    | Float  | 10 (% of value awarded to the app service provider)                                                |
| value_in_usd          | Float  | 1 (Fiat currency Transaction Value)                                                                |

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

#### Response
```javascript
{"client_id"=>28, "result_type"=>"transaction_types", "transaction_types"=> [ {"id"=>"5", "name"=>"Transaction 4", "kind"=>"company_to_user", "currency_type"=>"bt", "currency_value"=>"0.5", "commission_percent"=>"0.000", "status"=>"active"}], "meta"=>{"next_page_payload"=>{}}, "price_points"=>{"ost"=>{"usd"=>"1"}}, "client_tokens"=> [{"id"=>"16", "client_id"=>28, "reserve_managed_address_id"=>90, "name"=>"sd1", "symbol"=>"sd1", "symbol_icon"=>nil, "token_erc20_address"=>"0xdc1A2F9A712a38F673fe7758C35Bec4F9051Da63", "token_uuid"=> "0xf4842e7905d55ebd6699832662570539c2995d35e345360a4cf05e9b486e0a95", "conversion_rate"=>"1.000000", "created_at"=>"2018-02-20 08:16:27", "updated_at"=>"2018-02-20 08:31:44"}]}
```

### 3.Get list of existing transaction kinds 

The details and parameters of the list of different user actions that lead to transactions between end-users, the application service provider or _company_ can be obtained using this API.


#### GET 
```url
{{saas_api_url}}/transaction/kind/get-all?page_no=1
```
	
#### Parameters 
| Parameter | Type | Value                                         |
|-----------|------|-----------------------------------------------|
| page_no   | Int  | 1 (page number for all the transaction types) |

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

#### Response
```javascript
{"client_id"=>28, "result_type"=>"transaction_types", "transaction_types"=> [{"id"=>"4", "name"=>"Transaction 1", "kind"=>"user_to_user", "currency_type"=>"bt", "currency_value"=>"10", "commission_percent"=>"0.000", "status"=>"active"}, {"id"=>"2", "name"=>"Transaction 2", "kind"=>"company_to_user", "currency_type"=>"usd", "currency_value"=>"1.000000", "commission_percent"=>"10.000", "status"=>"active"}, {"id"=>"3", "name"=>"Transaction 3", "kind"=>"user_to_company", "currency_type"=>"usd", "currency_value"=>"0.500000", "commission_percent"=>"10.000", "status"=>"active"}, {"id"=>"5", "name"=>"Transaction 4", "kind"=>"company_to_user", "currency_type"=>"bt", "currency_value"=>"0.5", "commission_percent"=>"0.000", "status"=>"active"}], "meta"=>{"next_page_payload"=>{}}, "price_points"=>{"ost"=>{"usd"=>"1"}}, "client_tokens"=> [{"id"=>"16", "client_id"=>28, "reserve_managed_address_id"=>90, "name"=>"sd1", "symbol"=>"sd1", "symbol_icon"=>nil, "token_erc20_address"=>"0xdc1A2F9A712a38F673fe7758C35Bec4F9051Da63", "token_uuid"=> "0xf4842e7905d55ebd6699832662570539c2995d35e345360a4cf05e9b486e0a95", "conversion_rate"=>"1.000000", "created_at"=>"2018-02-20 08:16:27", "updated_at"=>"2018-02-20 08:31:44"}]}
```


#### Pagination
```javascript
"meta"=>{"next_page_payload"=>{"page_no"=>2}}
```

