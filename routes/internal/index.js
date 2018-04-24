const express = require('express')
  , router = express.Router()
;

const rootPrefix = '..'
  , rootRoutes = require(rootPrefix + '/routes/internal/root')
  , onBoardingRoutes = require(rootPrefix + '/routes/internal/on_boarding')
  , stakeRoutes = require(rootPrefix + '/routes/internal/stake')
  , clientRoutes = require(rootPrefix + '/routes/internal/client')
  , simulatorRoutes = require(rootPrefix + '/routes/internal/simulator')
  , clientUsersRoutes = require(rootPrefix + '/routes/internal/client_users')
;

router.use('/', rootRoutes);

router.use('/on-boarding', onBoardingRoutes);

router.use('/stake', stakeRoutes);

router.use('/client', clientRoutes);

router.use('/simulator', simulatorRoutes);

router.use('/client-users', clientUsersRoutes);

module.exports = router;
