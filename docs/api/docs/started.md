---
id: started
title: Getting Started 
sidebar_label: Getting Started 
---

The API documentation for the the complete blockchain toolkit for businesses. 

OST helps you launch and manage your cryptocurrency powered economy. Great OST use cases include projects with P2P micro-payments, enabling transparent and incentives and rewards, monetizing API calls, low cost cross-border payments and many more.

## Create your Branded Tokens 
ostKIT aplha enables you to design create and manage your branded token economy.  You may want to set just one branded token for your company or a few, depending upon the range of services and product variations you offer. For example : ….

You can proceed through the rest of the tutorial ones who have created your branded token using ostKIT alpha.

## Create Users 

Users here represent your actual users and ost provides an easy way to process their token transfers. Your business may onboard your existing or new end-users to participate in your branded token economy.
Note: This tutorial assumes you’ve created api signature using steps given here and are aware of the Error Handling recommendations. 

This code creates a user via API 

### POST  
```url
{{saas_api_url}}/addresses/create
```
### Parameters 

| Attribute | Type   | Value  |
|-----------|--------|--------|
| _name_      | String | Puneet (sample name) |

### Sample Code | Curl 

```bash
curl --request POST \
 --url 'http://{{saas_api_url}}/addresses/create' \
 --data name=Puneet%20
```

OST returns an object?? With all the relevant details : 
### Response
```javascript
{"result_type"=>"economy_users", "economy_users"=>  [{"id"=>160,
"uuid"=>"4697a3c8-7aa8-47c7-8192-6df7b90f1e7f", "name"=>"PK",
"total_airdropped_tokens"=>0, "token_balance"=>0}],
"meta"=>{"next_page_payload"=>{}}}
```

Once you create a user, store the “uuid” value in your own database for later reference (presumably with the user’s name or email id.)

		
3. View the list of default Transactions.
4. Run a Transaction.

### NEXT STEPS
Congrats! You’ve run a transaction in your branded token ecosystem. You may want to learn how to setup transactions , add users and run specific transactions in more detail.
