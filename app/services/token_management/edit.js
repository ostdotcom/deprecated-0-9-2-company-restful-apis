"use strict";

const rootPrefix = '../../..'
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , ClientBrandedTokenKlass = require(rootPrefix + '/app/models/client_branded_token')
  , clientBrandedTokenObj = new ClientBrandedTokenKlass();
;

const EditBrandedTokenKlass = function (params) {

  var oThis = this;

  oThis.params = params;
  oThis.client_id = oThis.params.client_id;
  oThis.name = oThis.params.name;
  oThis.symbol = oThis.params.symbol;
  oThis.symbol_icon = oThis.params.symbol_icon;
  oThis.token_erc20_address = oThis.params.token_erc20_address;
  oThis.token_uuid = oThis.params.token_uuid;
  oThis.conversion_rate = oThis.params.conversion_rate;

  oThis.brandedTokenAr = null;

};

EditBrandedTokenKlass.prototype = {

  perform: async function () {
    var oThis = this
      , r = null;

    r = await oThis.validateAndSanitize();
    if(r.isFailure()) return Promise.resolve(r);

    r = await oThis.editToken();
    if(r.isFailure()) return Promise.resolve(r);

    return oThis.returnResponse();

  },

  validateAndSanitize: async function () {
    var oThis = this;

    if(!oThis.client_id || !oThis.symbol || !basicHelper.isBTSymbolValid(oThis.symbol)){
      return Promise.resolve(responseHelper.error('tm_e_1', 'Unauthorized access'));
    }

    const clientBrandedTokens = await clientBrandedTokenObj.getBySymbol(oThis.symbol);
    if(clientBrandedTokens.length <= 0){
      return Promise.resolve(responseHelper.error('tm_e_2', 'Invalid Edit request'));
    }

    oThis.brandedTokenAr = clientBrandedTokens[0];

    if(oThis.brandedTokenAr.client_id != oThis.client_id){
      return Promise.resolve(responseHelper.error('tm_e_3', 'Unauthorized access'));
    }

    if(oThis.name && basicHelper.isBTNameValid(oThis.name) && oThis.name != oThis.brandedTokenAr.name){
      oThis.brandedTokenAr.name = oThis.name;
    }
    if(oThis.symbol_icon && oThis.symbol_icon != oThis.brandedTokenAr.symbol_icon){
      oThis.brandedTokenAr.symbol_icon = oThis.symbol_icon;
    }
    if(oThis.token_erc20_address && basicHelper.isAddressValid(oThis.token_erc20_address) &&
      oThis.token_erc20_address != oThis.brandedTokenAr.token_erc20_address
    ){
      oThis.brandedTokenAr.token_erc20_address = oThis.token_erc20_address;
    }
    if(oThis.token_uuid && basicHelper.isUuidValid(oThis.token_uuid) &&
      oThis.token_uuid != oThis.brandedTokenAr.token_uuid
    ){
      oThis.brandedTokenAr.token_uuid = oThis.token_uuid;
    }
    if(oThis.conversion_rate && basicHelper.isBTConversionRateValid(oThis.conversion_rate) &&
      oThis.conversion_rate != oThis.brandedTokenAr.conversion_rate
    ){
      oThis.brandedTokenAr.conversion_rate = oThis.conversion_rate;
    }

    return Promise.resolve(responseHelper.successWithData({}));
  },

  editToken: async function () {

    var oThis = this;

    await clientBrandedTokenObj.edit(
      {
        qParams: oThis.brandedTokenAr,
        whereCondition: {
          id: oThis.brandedTokenAr.id
        }
      }
    )

    return Promise.resolve(responseHelper.successWithData({}));

  },

  returnResponse: function () {
    return Promise.resolve(responseHelper.successWithData({}));
  }

};

module.exports = EditBrandedTokenKlass;