"use strict";

const openStPlatform = require('@openstfoundation/openst-platform');

const rootPrefix = '../../..'
  , managedAddressKlass = require(rootPrefix + '/app/models/managed_address')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
;


const BaseKlass = function () {};

BaseKlass.prototype = {

  perform: async function () {

    var r = null
      , oThis = this;

    r = await oThis.validateAndSanitize();
    if(r.isFailure()) return Promise.resolve(r);

    await oThis.setTokenUuid();

    await oThis.setBenificiaryAddress();

    await oThis.initiateStakeAndMint();

    return oThis.returnResponse();

  },

  setBenificiaryAddress: async function(){
    var oThis = this;

    const reserveAddressId = oThis.brandedToken.reserve_managed_address_id
      , managedAddressObj = new managedAddressKlass();

    const managedAddress = await managedAddressObj.getByIds([reserveAddressId]);
    oThis.benificieryAddress = managedAddress[0].ethereum_address;

    return Promise.resolve(responseHelper.successWithData({}));
  },

  initiateStakeAndMint: async function () {
    var oThis = this;

    const object = new openStPlatform.services.stake.start({
      'beneficiary': oThis.benificieryAddress,
      'to_stake_amount': oThis.toStakeAmount,
      'uuid': oThis.uuid
    });

    oThis.stakeResponse = await object.perform();

    return Promise.resolve(responseHelper.successWithData({}));
  },

  returnResponse: function(){
    var oThis = this;

    if(oThis.stakeResponse.isSuccess()){

      return Promise.resolve(
        responseHelper.successWithData(
          oThis.stakeResponse.data
        ));

    } else {

      return Promise.resolve(
        responseHelper.error(
          oThis.stakeResponse.err.code,
          oThis.stakeResponse.err.message
        ));

    }
  }

};

module.exports = BaseKlass;