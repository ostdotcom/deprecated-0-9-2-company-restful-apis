---
id: error
title: Error Handling documentation
sidebar_label:Error handling 
---

We use conventional HTTP response codes to indicate the success or failure of an API request. In general, codes in the 2xx range indicate success, codes in the 4xx range indicate an error that failed given the information provided and codes in the 5xx range indicate an error with OST's servers (these are rare).


### HTTP status code summary
| 200 - OK                           | Everything worked as expected.                                           |
|------------------------------------|--------------------------------------------------------------------------|
| 400 - Bad Request                  | The request was unacceptable, often due to missing a required parameter. |
| 401 - Unauthorized                 | No valid API key provided.                                               |
| 404 - Not Found                    | The requested resource doesn't exist.                                    |
| 500, 502, 503, 504 - Server Errors | Something went wrong on OST's end. (These are rare.)                     |

Not all errors map cleanly onto HTTP response codes, however. When a request is valid but does not completec successfully (...example...), we return a - success => false. User will reciever 200OK for the request, but one of the parameters, success value will be false. To understand better an error there are other attributes in the response code which can be referred to.

### Response Format 
```javascript
{:success=>false,
 :err=>
  {:code=>"sd",
   :display_text=>"Something went wrong.",
   :display_heading=>"Error.",
   :error_data=>{}},
 :data=>{}}
 ```


### Attributes
 convert into table with Attribute, type, Definition 
#### Code 
A short string related to the kind of error that occurred

#### _display_heading_
A short string describing the kind of error that occurred. You can use this to display as the header of the error message pop-up.

#### _Display_text_
A string the further describes the error that occurred. This can be used to display the message near the appropriate form field for example. These messages are more generic

#### _Error_data_ (optional)
The _Error_data_ relates to if the error is parameter specific. Its a key-value pair where the key will be the parameter name and the corresponding error string for it. This can be used to display specific messages at appropriate user interface. These are parameter specific. Can be used to show errors in form fields.

#### Pagination

```javascript
"meta"=>{"next_page_payload"=>{"page_no"=>2}}
```

### Updates

We shall send information on new additions and changes to API and language libraries to the Be sure to subscribe to stay informed.



