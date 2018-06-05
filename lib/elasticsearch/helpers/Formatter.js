"use strict";

const rootPrefix      = ".."
    , logger          = require( rootPrefix + "/providers/logger" )
    , BigNumber       = require("bignumber.js")
;

const Formatter = function ( rules ) {
  const oThis = this;

  oThis.rules = rules || {};

};

Formatter.prototype = {
  constructor: Formatter
  , rules: null
  , format: function ( inParams ) {
    const oThis = this;
    
    let outParams = {}
      , rules     = oThis.rules
      , inKey
      , inVal
      , outKey
      , outVal
      , rule
      , formatter
    ;

    let len = rules.length
      , cnt = 0
    ;

    for( cnt = 0 ; cnt < len ; cnt++ ) { 
      rule      = rules[ cnt ];
      inKey     = rule["inKey"] || "NOT_SPECIFIED";
      outVal    = inVal = inParams[ inKey ];
      outKey    = rule["outKey"];

      // Call the formatter.
      formatter = rule.formatter;
      if ( formatter ) {
        try {
          outVal = formatter( inVal , inParams , outParams);
        } catch( formatterError ) {
          throw {
            message           : "Formatter Threw an error"
            , rule            : rule
            , formatterError  : formatterError
            , inVal           : inVal
            , inKey           : inKey
          };
        }
      }

      // Populate outParams if required.
      if ( outKey ) {
        outParams[ outKey ] = outVal;  
      }
      
    }

    return outParams;
  }
};


Formatter.toString = function ( inVal ) {
  if ( Formatter.isNull( inVal ) ) {
    return null;
  }

  if ( inVal instanceof BigNumber ) {
    return inVal.toString( 10 );
  }

  if ( inVal instanceof Object ) {
    throw "Can not convert Object to String. Please use toJSON instead of toString.";
  }

  return String( inVal );
};

Formatter.toNonEmptyString = function ( inVal ) {
  if ( Formatter.isNull( inVal ) ) {
    throw "Value to format can not be null.";
  }

  let outVal = Formatter.toString( inVal );

  if ( !outVal ) {
    throw "Value is an empty string."
  }

  return outVal ; 
};

Formatter.toJSON = function ( obj ) {
  if ( Formatter.isNull( inVal ) ) {
    return null;
  }

  if ( inVal instanceof Object ) { 
    return JSON.stringify(obj);
  }
  throw "'" + obj + "' is not an object";
};


Formatter.toNumber = function( inVal ) {
  if ( Formatter.isNull( inVal ) ) {
    return null;
  }

  let outVal = Number( inVal );
  if ( isNaN( outVal) ) {
    throw "'" + inVal + "' is not a number";
  }
  return outVal;
};

Formatter.toValidNumber = function( inVal ) {
  if ( Formatter.isNull( inVal ) ) {
    throw "Value to format can not be null.";
  }
  let outVal = Formatter.toNumber( inVal );
  return outVal;
};

Formatter.toNonZeroValidNumber = function( inVal ) {
  if ( Formatter.isNull( inVal ) ) {
    throw "Value to format can not be null.";
  }
  let outVal = Formatter.toNumber( inVal );
  if ( 0 === outVal ) {
    throw "'" + inVal + "'is zero.";
  }
  return outVal;
};

Formatter.toBN = function( inVal ) {
  return ( inVal instanceof BigNumber ) ? inVal : ( new BigNumber( inVal ) ); 
};

Formatter.fromEth = function( inVal ){
  return Formatter.fromEthBN( inVal ).toString( 10 );
};

const ETHFactor = new BigNumber( 10 ).toPower(18);
const ETH_TRIM_AFTER = 5;


Formatter.toEth = function ( inVal ) {
  if ( Formatter.isNull( inVal ) ) {
    return null;
  }

  let outVal = Formatter.toEthBN( inVal );
  return outVal.toString( 10 );
};
Formatter.toFloatEth = function ( inVal ) {
  if ( Formatter.isNull( inVal ) ) {
    return null;
  }

  let outVal = Formatter.toEthBN( inVal );
  return outVal.toNumber();
};

Formatter.toValidFloatEth = function ( inVal ) { 
  if ( Formatter.isNull( inVal ) ) { 
    throw "Value to format can not be null";
  }
  return Formatter.toFloatEth( inVal );
};

Formatter.toEthBN = function ( inVal ) {
  let outVal = Formatter.toBN( inVal ).dividedBy( ETHFactor )
  const ROUND_DOWN = 1;

  if ( outVal.isNaN() ) {
    throw "'" + inVal + "' can not be converted into BigNumber";
  }

  outVal = outVal.toFixed( ETH_TRIM_AFTER, ROUND_DOWN );
  return new BigNumber( outVal );
};

Formatter.isNull = function ( inVal ) {
  return null === inVal || typeof inVal === "undefined";
};

module.exports = Formatter;