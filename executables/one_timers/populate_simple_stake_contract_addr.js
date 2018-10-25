// 'use strict';
//
// const rootPrefix = '../..',
//   openSTNotification = require('@openstfoundation/openst-notification'),
//   ClientBrandedTokenModel = require(rootPrefix + '/app/models/client_branded_token'),
//   openStPlatform = require('@openstfoundation/openst-platform'),
//   chainIntConstants = require(rootPrefix + '/config/chain_interaction_constants'),
//   ClientBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/client_branded_token'),
//   ClientSecuredBrandedTokenCacheKlass = require(rootPrefix + '/lib/cache_management/clientBrandedTokenSecure');
//
// const PopulateSimpleStakeContractAddr = {
//   perform: async function() {
//     const sleep = function(ms) {
//       return new Promise(function(resolve) {
//         setTimeout(resolve, ms);
//       });
//     };
//
//     await sleep(5000);
//
//     let modelObj = new ClientBrandedTokenModel();
//
//     let dbRows = await modelObj
//       .select('*')
//       .where({ client_id: '3548', simple_stake_contract_addr: '0x0000000000000000000000000000000000000000' })
//       .fire();
//
//     for (let i = 0; i < dbRows.length; i++) {
//       let dbRow = dbRows[i];
//
//       console.log(`starting for ${dbRow.id}`);
//
//       if (!dbRow.token_uuid || !dbRow.token_erc20_address) {
//         console.log(`ignoring ${dbRow.id}`);
//       }
//
//       let platformObject = new openStPlatform.services.utils.getBrandedTokenDetails({
//         uuid: dbRow.token_uuid
//       });
//
//       let getBtDetailsRsp = await platformObject.perform();
//
//       if (getBtDetailsRsp.isFailure()) {
//         console.error(`getBtDetailsRsp failed for ${dbRow.id}`, getBtDetailsRsp.toHash());
//         continue;
//       } else {
//         let simpleStakeContractAddr = getBtDetailsRsp.data.simple_stake_contract_address;
//         if (!simpleStakeContractAddr) {
//           console.error(`simpleStakeContractAddr not found for ${dbRow.id}`, getBtDetailsRsp.toHash());
//           continue;
//         } else {
//           console.log(`simpleStakeContractAddr found for ${dbRow.id} : ${simpleStakeContractAddr}`);
//           dbRow.simple_stake_contract_addr = simpleStakeContractAddr;
//         }
//       }
//
//       await new ClientBrandedTokenModel()
//         .update({ simple_stake_contract_addr: dbRow.simple_stake_contract_addr })
//         .where(['id = ?', dbRow.id])
//         .fire();
//
//       const clientBrandedTokenCache = new ClientBrandedTokenCacheKlass({ clientId: dbRow.client_id });
//       clientBrandedTokenCache.clear();
//
//       const clientSecureBrandedTokenCache = new ClientSecuredBrandedTokenCacheKlass({ tokenSymbol: dbRow.symbol });
//       clientSecureBrandedTokenCache.clear();
//
//       let publish_data = {};
//
//       publish_data.name = dbRow.name;
//       publish_data.ost_to_bt_conversion_factor = dbRow.conversion_factor;
//       publish_data.symbol_icon = dbRow.symbol_icon;
//       publish_data.symbol = dbRow.symbol;
//       publish_data.uuid = dbRow.token_uuid;
//       publish_data.created_at = new Date(dbRow.created_at).getTime() / 1000;
//       publish_data.simple_stake_contract_addr = dbRow.simple_stake_contract_addr;
//
//       console.log(`publish_data for ${dbRow.id} : ${JSON.stringify(publish_data)}`);
//
//       await openSTNotification.publishEvent.perform({
//         topics: ['entity.branded_token'],
//         publisher: 'OST',
//         message: {
//           kind: 'shared_entity',
//           payload: {
//             entity: 'branded_token',
//             identifier: {
//               erc20_contract_address: dbRow.token_erc20_address,
//               chain_id: chainIntConstants.UTILITY_CHAIN_ID
//             },
//             operation: 'update',
//             data: publish_data
//           }
//         }
//       });
//     }
//   }
// };
//
// module.exports = PopulateSimpleStakeContractAddr;
// PopulateSimpleStakeContractAddr.perform();
