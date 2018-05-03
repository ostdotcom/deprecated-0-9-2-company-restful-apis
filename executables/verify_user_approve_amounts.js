"use strict";

const rootPrefix = ".."
  , managedAddressModel = require(rootPrefix + '/app/models/managed_address')
  , managedAddressesConst = require(rootPrefix + '/lib/global_constant/managed_addresses')
  , ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token')
  , BrandedTokenKlass = require(rootPrefix + '/node_modules/\@openstfoundation/openst-platform/lib/contract_interact/branded_token')
  , basicHelper = require(rootPrefix + '/helpers/basic')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , apiVersions = require(rootPrefix + '/lib/global_constant/api_versions')
  , errorConfig = basicHelper.fetchErrorConfig(apiVersions.general)
;

const VerifyUserApprovalAmountsKlass = function(params){

  const oThis = this;

  oThis.startClientId = params['startClientId'];
  oThis.endClientId = params['endClientId'];
  oThis.clientIds = params['clientIds'];
  oThis.clientIdDetailsMap = {};
  oThis.problamaticIds = [];

};

VerifyUserApprovalAmountsKlass.prototype = {

  perform: async function () {

    const oThis = this;

    var r = await oThis.setclientIds();
    if (r.isFailure()) {
      return Promise.resolve(r);
    }

    var r = await oThis.setclientIdDetailsMap();
    if (r.isFailure()) {
      return Promise.resolve(r);
    }

    var r = await oThis.checkStatuses();
    return Promise.resolve(r);

  },

  setclientIdDetailsMap: async function() {

    const oThis = this
        , clientBrandedTokens = await new ClientBrandedTokenModel().select('*')
            .where(['client_id IN (?)', oThis.clientIds]).fire();

    var clientBrandedToken = null;

    for(var i=0; i<clientBrandedTokens.length; i++) {
      clientBrandedToken = clientBrandedTokens[i];
      oThis.clientIdDetailsMap[parseInt(clientBrandedToken.client_id)] = {
        airdropContractAddr: clientBrandedToken.airdrop_contract_addr,
        btContractAddr: clientBrandedToken.token_erc20_address
      };
    }

    oThis.clientIds = Object.keys(oThis.clientIdDetailsMap); //replace ids as outside world might have passed invalid ids

    return responseHelper.successWithData({});

  },

  setclientIds: async function() {

    const oThis = this;

    if (oThis.clientIds && oThis.clientIds.length >0 ) {
      return responseHelper.successWithData({});
    }

    if (!oThis.startClientId || !oThis.endClientId) {
      return responseHelper.error({
        internal_error_identifier: 'e_vuam_1',
        api_error_identifier: 'invalid_params',
        error_config: errorConfig
      });
    }

    oThis.clientIds = [];

    for(var i=oThis.startClientId; i<=oThis.endClientId; i++) {
      oThis.clientIds.push(i);
    }

    logger.info('oThis.clientIds set: ', oThis.clientIds);

    return responseHelper.successWithData({});

  },

  checkStatuses: async function() {

    const oThis = this;

    console.log('oThis.clientIdDetailsMap',  oThis.clientIdDetailsMap);

    for(var j=0; j<oThis.clientIds.length; j++) {

      const clientId = parseInt(oThis.clientIds[j])
          , clientDetail = oThis.clientIdDetailsMap[clientId]
          , clientAirdropContractAddr = clientDetail.airdropContractAddr
          , clientBtContractAddr = clientDetail.btContractAddr
          , managedAddresses = await new managedAddressModel().select('id, properties, ethereum_address, client_id')
                .where(['client_id = ?', clientId]).fire();

      if(!clientBtContractAddr || !clientAirdropContractAddr) {
        console.log('skipping for clientId: ', clientId);
        continue;
      }
      console.log('starting for clientId',  clientId);
      // console.log('clientDetail', clientDetail);

      for(var i=0; i<managedAddresses.length; i++) {

        var managedAddress = managedAddresses[i];

        // console.log('starting: ', managedAddress.id, clientDetail);

        if (!new managedAddressModel().isBitSet(managedAddressesConst.bTContractApproved, managedAddress.properties)) {
          // console.log('ignoring: ', managedAddress.id);
          continue;
        }

        var btContractObj = new BrandedTokenKlass({ERC20: clientBtContractAddr});

        var getAllowanceRsp = await btContractObj.getAllowance(managedAddress.ethereum_address, clientAirdropContractAddr);
        // console.log('getAllowanceRsp', getAllowanceRsp)
        if (getAllowanceRsp.isFailure() || !getAllowanceRsp.data.allowance || basicHelper.convertToBigNumber(getAllowanceRsp.data.allowance).lessThanOrEqualTo(0)) {
          console.error('problem with id: ', managedAddress.id);
          oThis.problamaticIds.push(managedAddress.id);
        }

      }

    }

    console.log('oThis.problamaticIds', oThis.problamaticIds);

    return responseHelper.successWithData({});

  }

};

const populateData = new VerifyUserApprovalAmountsKlass({startClientId: 1021, endClientId: 1021});
populateData.perform().then();