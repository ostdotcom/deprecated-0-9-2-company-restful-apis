const rootPrefix      = "../.."
    , logger          = require( rootPrefix + "/providers/logger" )
    , Formatter       = require( rootPrefix + "/helpers/Formatter")
    , BigNumber       = require( "bignumber.js" )
;

const rules = [];
module.exports = new Formatter( rules );


rule("inKey": "total", )