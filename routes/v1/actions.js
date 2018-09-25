'use strict';

const express = require('express');

const rootPrefix = '../..',
  routeHelper = require(rootPrefix + '/routes/helper');

const router = express.Router();

require(rootPrefix + '/app/services/transaction_kind/add_new');
require(rootPrefix + '/app/services/transaction_kind/edit');
require(rootPrefix + '/app/services/transaction_kind/list');
require(rootPrefix + '/app/services/transaction_kind/get');

/**
 * Create an Action
 *
 * @name Create Action
 *
 * @route {POST} {base_url}/actions
 *
 * @routeparam {string} :name (mandatory) - name of the action, unique
 * @routeparam {string} :kind (mandatory) - "user_to_user", "company_to_user", or "user_to_company"
 * @routeparam {string} :currency (mandatory) - "USD" (fixed), or "BT" (floating)
 * @routeparam {boolean} :arbitrary_amount (mandatory) - True/False
 * @routeparam {string<float>} :amount (optional) - "USD" (min USD 0.01), or "BT" (min BT 0.00001). If 'arbitrary_amount' is
 *                                            'True', an error should be raised if an 'amount' is passed;
 *                                             if 'arbitrary_amount' is 'False', an 'amount' must be set here.
 *
 * @routeparam {boolean} :arbitrary_commission (optional) - True/Flase
 * @routeparam {string<float>} :commission_percent (optional) - Only for "user_to_user" kind. (min 0%, max 100%).
 *                                                              If 'arbitrary_commission' is 'True', an error should be
 *                                                              raised if a 'commission' is passed;
 *                                                              if 'arbitrary_commission' is 'False', a 'commission'
 *                                                              must be set here.
 */
router.post('/', function(req, res, next) {
  req.decodedParams.apiName = 'create_new_action';

  const dataFormatterFunc = async function(response) {
    delete response.data.extra_entities;
  };

  Promise.resolve(routeHelper.performer(req, res, next, 'getAddNewActionClass', 'r_v1_a_1', null, dataFormatterFunc));
});

/* Update action */
router.post('/:id', function(req, res, next) {
  req.decodedParams.apiName = 'update_action';

  req.decodedParams.id = req.params.id;

  Promise.resolve(routeHelper.performer(req, res, next, 'getEditActionClass', 'r_v1_a_2'));
});

/* Get list of actions */
router.get('/', function(req, res, next) {
  req.decodedParams.apiName = 'list_actions';

  Promise.resolve(routeHelper.performer(req, res, next, 'getListActionsClass', 'r_v1_a_3'));
});

/* Get an action by id */
router.get('/:id', function(req, res, next) {
  req.decodedParams.apiName = 'get_action';

  req.decodedParams.id = req.params.id;

  Promise.resolve(routeHelper.performer(req, res, next, 'getGetActionClass', 'r_v1_a_4'));
});

module.exports = router;
