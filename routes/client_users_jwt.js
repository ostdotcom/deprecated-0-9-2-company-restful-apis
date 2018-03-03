const express = require('express')
  , router = express.Router()
  , rootPrefix = '..'
  , routeHelper = require(rootPrefix + '/routes/helper')
;

/* Get users details for given ethereum addresses. */
router.get('/get-details', function (req, res, next) {

  const getUsersDataKlass = require(rootPrefix + '/app/services/client_users/get_users_data');

  Promise.resolve(routeHelper.performer(req, res, next, getUsersDataKlass, 'r_cuj_1'));

});

module.exports = router;
