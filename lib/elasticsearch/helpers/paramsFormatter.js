"use strict";

const rootPrefix      = "../../"
    , logger          = require( rootPrefix + "/providers/logger" )
;

const Formatter = function ( rules ) {
  const oThis = this;

  oThis.rules = rules || {};

};

Formatter.prototype = {
  constructor: Formatter
  , rules: null
  , format: function ( inParams ) {

    let outParams = {}
      , inKey
      , inVal
      , outKey
      , outVal
      , rule
      , formatter
    ;

    for( inKey in rules ) { if ( 
      !rules.hasOwnProperty( inKey ) ) { continue; } 
      rule  = rules[ inKey ];
      outVal = inVal = inParams[ inKey ];

      outKey = rule["to"];
      if ( !outKey ) {
        throw "Incorrect rule defination. rule must have 'to' property. rule: " + JSON.stringify( rule ) ;
      }

      formatter = rule.formatter;
      if ( formatter ) {
        outVal = formatter( inVal );
      }



      outParams[ outKey ] = outVal;
    }

    return outParams;
  }
};

Formatter.toNonEmptyString = function ( inVal ) {
  if ( inVal === null ) {
    throw "Value to format can not be null.";
  }
  let outVal = String( inVal );
  if ( !outVal ) {
    throw "Value is an empty string."
  }
  return outVal ; 
};

Formatter.toString = function ( inVal ) {
  if ( inVal === null ) {
    return null;
  }
  return String( inVal );
}


Formatter.toNumber = function( inVal ) {
  if ( inVal === null ) {
    return null;
  }
  let outVal = Number( inVal );
  if ( isNaN( outVal) ) {
    throw "'" + inVal + "' is not a number";
  }
  return outVal;
};

Formatter.toFloat = function( inVal ) {
  if ( inVal === null ) {
    return null;
  }
  return parseFloat( inVal );
};

Formatter.toValidFloat = function( inVal ) {
  if ( inVal === null ) {
    throw "Value to format can not be null.";
  }
  let outVal = parseFloat( inVal );
  if ( !outVal ) {
    throw "Value is an empty string."
  }
  return outVal ; 
}; 

 

Formatter.toBN = function( inVal ) {
  return ( inVal instanceof BigNumber ) ? inVal : BigNumber( inVal ); 
}; 

Formatter.toWei =. function( inVal ){
  return Formatter.toWeiBN( inVal ).toString( 10 );
};

Formatter.toWeiBN =. function( inVal ){
  return Formatter.toBN( inVal ).mul( Formatter.toBN(10).toPower(18)).tofixed( 5 ); 
};






module.exports = Formatter;