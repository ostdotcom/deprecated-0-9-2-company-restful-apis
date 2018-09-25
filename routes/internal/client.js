const express = require('express'),
  router = express.Router();

const rootPrefix = '../..',
  routeHelper = require(rootPrefix + '/routes/helper');

require(rootPrefix + '/app/services/client/fetch_stats');

/* fetch stats for a client token */
router.get('/fetch-stats', function(req, res, next) {
  req.decodedParams.apiName = 'fetch_client_stats';

  routeHelper.performer(req, res, next, 'getFetchClientStatsClass', 'r_ct_1');
});

module.exports = router;
