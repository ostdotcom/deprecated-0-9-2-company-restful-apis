"use strict";

const express = require('express')
;

const rootPrefix = '../..'
  , usersRoutes = require(rootPrefix + '/routes/v0.1/users')
  , actionRoutes = require(rootPrefix + '/routes/v0.1/actions')
  , transactionsRoutes = require(rootPrefix + '/routes/v0.1/transactions')
  , airdropsRoutes = require(rootPrefix + '/routes/v0.1/airdrops')
  , transfersRoutes = require(rootPrefix + '/routes/v0.1/transfers')
;

const router = express.Router()
;

//router.use('/', rootRoutes);

// router.use('/users', usersRoutes);
//
// router.use('/actions', actionRoutes);
//
// router.use('/transactions', transactionsRoutes);
//
// router.use('/airdrops', airdropsRoutes);
//
// router.use('/transfers', transfersRoutes);


module.exports = router;
