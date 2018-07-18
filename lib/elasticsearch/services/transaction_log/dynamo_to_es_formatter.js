"use strict";

const rootPrefix      = "../.."
    , logger          = require( rootPrefix + "/providers/logger" )
    , Formatter       = require( rootPrefix + "/helpers/Formatter")
    , dynamoHelpers   = require( rootPrefix + "/helpers/dynamo_formatters")
    , BigNumber       = require( "bignumber.js" )
;

const rules = [];
module.exports = new Formatter( rules );

rules.push( {"inKey": "txu",  "outKey": "id", "formatter": dynamoHelpers.toNonEmptyString } );

rules.push( {"inKey": "txh",  "outKey": "transaction_hash", "formatter": dynamoHelpers.toString } );

rules.push( {"inKey": "tt",   "outKey": "type", "formatter": dynamoHelpers.toValidNumber } );

rules.push( {"inKey": "ci",   "outKey": "client_id", "formatter": dynamoHelpers.toNumber } );

rules.push( {"inKey": "ai",   "outKey": "action_id", "formatter": dynamoHelpers.toNumber } );

rules.push( {"inKey": "fu",   "outKey": "from_uuid", "formatter": dynamoHelpers.toString } );

rules.push( {"inKey": "tu",   "outKey": "to_uuid", "formatter": dynamoHelpers.toString } );

rules.push( {"inKey": "aiw",  "outKey": "amount_in_base_currency", "formatter": dynamoHelpers.toFloatEth } );

rules.push( {"inKey": "s",    "outKey": "status", "formatter": dynamoHelpers.toValidNumber } );

rules.push( {"inKey": "ca",   "outKey": "created_at", "formatter": dynamoHelpers.toSecondTimestamp } );

rules.push( {"inKey": "ua",   "outKey": "updated_at", "formatter": dynamoHelpers.toSecondTimestamp } );

rules.push({
  "outKey": "has_commission"
  , "formatter": function ( inVal, inParams ) {
    //inVal will be null as no inKey is specified.

    let commissionAmountInWeiStr = dynamoHelpers.val( inParams["caiw"] )
    ;

    if (Formatter.isNull( commissionAmountInWeiStr )) {
      return false;
    }

    let commissionAmountInWei = new BigNumber( commissionAmountInWeiStr );

    return commissionAmountInWei.gt(new BigNumber(0));

  }
});



/** 
tt    N -- done
tu    S -- done
caiw  N -- done
txh   S -- done 
ci    N -- done
ai    N -- done
gp    N -- na (BN)
bn    N -- na
ua    N -- done
aiw   N -- done
gu    N -- na (BN)
fu    S -- done
txu   S -- done
te    L
    fa   S -- done
    fu   S -- done
    ta   S -- done
    tu   S -- done
    aiw  S -- done
s     N -- done
cti   N -- na
ca    N -- done
ts    S -- na
fa    S -- done
ta    S -- done
**/


