---
id: authentication
title: Authentication API documentation
sidebar_label:Authentication
---


Authenticate your account when using the API by including the API signature in each API request.  You can get your API keys in the ostKIT alpha developers page **_link_**.  Please be sure to keep your API keys safely. Do not share your secret API keys in publicly accessible areas such as GitHub, docs etc. 

To generate the API signature follow the steps below:

### 1.String-to-sign creation by concatenation 

#### API Endpoint
```url
https://ost.com/api
```
#### API Parameters  
```javascript
{“ethereum_address” => “0xccf5571277b74586733de2e68064ab234ef2a9a8”}
```
#### API timestamp
Request_timestamp :  “1519281513”

string_to_sign = Api Endpoint + '::' + Request_timestamp + '::' + 
Request_params (sorted alphabetically)

Example.

< ---- >


### 2.Generating a Signature.

**generated-signature** = Hmac_Sha256_Hexdigest(string-to-sign, api-secret)
	
#### Final Request url

```url
https://sale.simpletoken.org/api/v1/kyc/add-kyc/?api_key=your-key&signature=generated-signature&request_time=2018-01-01T16:40:50+05:30&api_parameters
```
Please ensure that the final URL is encoded while making the API request.
Please find below a sample Ruby code:

< code >

```ruby
def generate_signature(api_secret, string_to_sign)
    digest = OpenSSL::Digest.new('sha256')
    OpenSSL::HMAC.hexdigest(digest, api_secret, string_to_sign)
End
```


### 3.Adding parameters to each API call

With each api endpoint these are the three additional parameters that you will need to add. 

```javascript
{"request-timestamp" => request_timestamp, "signature" => signature, "api-key" => api_key}
```

