'use strict';

const express = require('express');

const rootPrefix = '../..',
  // Routes which wre implemented with V1.0 go here

  usersRoutes = require(rootPrefix + '/routes/v1/users'),
  tokenRoutes = require(rootPrefix + '/routes/v1/token'),
  actionRoutes = require(rootPrefix + '/routes/v1/actions'),
  airdropsRoutes = require(rootPrefix + '/routes/v1/airdrops'),
  transfersRoutes = require(rootPrefix + '/routes/v1/transfers'),
  // Routes which were implemented with V1.1 go below this

  balancesRoutes = require(rootPrefix + '/routes/v1.1/balances'),
  ledgerRoutes = require(rootPrefix + '/routes/v1.1/ledger'),
  transactionsRoutes = require(rootPrefix + '/routes/v1.1/transactions');

const router = express.Router();

router.use('/users', usersRoutes);

router.use('/token', tokenRoutes);

router.use('/airdrops', airdropsRoutes);

router.use('/actions', actionRoutes);

router.use('/transactions', transactionsRoutes);

router.use('/transfers', transfersRoutes);

router.use('/balances', balancesRoutes);

router.use('/ledger', ledgerRoutes);

module.exports = router;
