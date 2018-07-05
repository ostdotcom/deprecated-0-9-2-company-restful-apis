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

rules.push( {"inKey": "fa",   "outKey": "from_address", "formatter": dynamoHelpers.toString } );

rules.push( {"inKey": "tu",   "outKey": "to_uuid", "formatter": dynamoHelpers.toString } );

rules.push( {"inKey": "ta",   "outKey": "to_address", "formatter": dynamoHelpers.toString } );

rules.push( {"inKey": "aiw",  "outKey": "amount_in_base_currency", "formatter": dynamoHelpers.toFloatEth } );

rules.push( {"inKey": "caiw", "outKey": "commission_amount_in_base_currency", "formatter": dynamoHelpers.toFloatEth } );

rules.push( {"inKey": "s",    "outKey": "status", "formatter": dynamoHelpers.toValidNumber } );

rules.push( {"inKey": "ca",   "outKey": "created_at", "formatter": dynamoHelpers.toSecondTimestamp } );

rules.push( {"inKey": "ua",   "outKey": "updated_at", "formatter": dynamoHelpers.toSecondTimestamp } );

rules.push({
  "outKey": "transaction_fee_in_base_currency"
  , "formatter": function ( inVal, inParams ) {
    //inVal will be null as no inKey is specified.
    const gu = inParams["gu"]
        , gp = inParams["gp"]
    ;

    let gasUtilised = dynamoHelpers.val( gu )
      , gasPrice    = dynamoHelpers.val( gp )
      , fees
    ;

    if ( Formatter.isNull( gasUtilised ) || Formatter.isNull( gasPrice ) ) {
      return null;
    }

    gasUtilised = new BigNumber( gasUtilised );
    gasPrice    = new BigNumber( gasPrice);

    if ( gasUtilised.isNaN() ) {
      throw "'" + gu + "' is not a valid number";
    }
    
    if ( gasPrice.isNaN() ) { 
      throw "'" + gp + "' is not a valid number";
    }

    fees = gasUtilised.times( gasPrice );

    return Formatter.toFloatEth( fees );
  } 
});


const teRules       = []
      ,teFormatter  = new Formatter( teRules )
;

rules.push({
  "inKey": "te"
  , "outKey": "transfer_events"
  , "formatter": function ( inVal, inParams ) {
    inVal = dynamoHelpers.val( inVal );

    if ( Formatter.isNull( inVal ) ) {
      return null;
    }
    if ( !(inVal instanceof Array) ) {
      throw "'" + inVal + "' is not an Array.";
    }

    let len     = inVal.length
      , outVal  = []
      , inData
      , outData
      , cnt
    ;

    for( cnt = 0; cnt < len; cnt++ ) {
      inData  = dynamoHelpers.val( inVal[ cnt ] );
      outData = teFormatter.format( inData );
      outVal.push( outData );
    }

    return outVal;
  }
});

teRules.push( {"inKey": "fa",   "outKey": "from_address", "formatter": dynamoHelpers.toNonEmptyString } );

teRules.push( {"inKey": "fu",   "outKey": "from_uuid", "formatter": dynamoHelpers.toString } );

teRules.push( {"inKey": "ta",   "outKey": "to_address", "formatter": dynamoHelpers.toNonEmptyString } );

teRules.push( {"inKey": "tu",   "outKey": "to_uuid", "formatter": dynamoHelpers.toString } );

teRules.push( {"inKey": "aiw",  "outKey": "amount_in_base_currency", "formatter": dynamoHelpers.toValidFloatEth } );


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


