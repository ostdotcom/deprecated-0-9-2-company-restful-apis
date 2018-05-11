"use strict";

const express = require('express')
;

const rootPrefix = '../..'
  , rootRoutes = require(rootPrefix + '/routes/internal/root')
  , usersRoutes = require(rootPrefix + '/routes/v1/users')
  , tokenRoutes = require(rootPrefix + '/routes/v1/token')
  , actionRoutes = require(rootPrefix + '/routes/v1/actions')
  , transactionsRoutes = require(rootPrefix + '/routes/v1/transactions')
  , airdropsRoutes = require(rootPrefix + '/routes/v1/airdrops')
  , transfersRoutes = require(rootPrefix + '/routes/v1/transfers')
;

const router = express.Router()
;

//router.use('/', rootRoutes);

router.use('/users', usersRoutes);

router.use('/token', tokenRoutes);

router.use('/airdrops', airdropsRoutes);

router.use('/actions', actionRoutes);

router.use('/transactions', transactionsRoutes);

router.use('/transfers', transfersRoutes);


module.exports = router;
