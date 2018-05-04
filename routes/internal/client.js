
const express = require('express')
    , router = express.Router()
;

const rootPrefix = '../..'
    , fetchStatsKlass = require(rootPrefix + '/app/services/client/fetch_stats')
    , routeHelper = require(rootPrefix + '/routes/helper')
;

/* fetch stats for a client token */
router.get('/fetch-stats', function (req, res, next) {

  req.decodedParams.apiName = 'fetch_client_stats';

  routeHelper.performer(req, res, next, fetchStatsKlass, 'r_ct_1');

});

module.exports = router;
