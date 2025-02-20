'use strict';
/*
 * Main application file
 *
 * * Author: Rachin
 * * Date: 23/10/2017
 * * Reviewed by: Sunil
 */

const rootPrefix = '.';

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

const express = require('express'),
  path = require('path'),
  createNamespace = require('continuation-local-storage').createNamespace,
  morgan = require('morgan'),
  cookieParser = require('cookie-parser'),
  bodyParser = require('body-parser'),
  helmet = require('helmet'),
  sanitizer = require('express-sanitized'),
  customUrlParser = require('url'),
  cluster = require('cluster'),
  http = require('http');

const jwtAuth = require(rootPrefix + '/lib/jwt/jwt_auth'),
  responseHelper = require(rootPrefix + '/lib/formatter/response'),
  v0TransactionRoutes = require(rootPrefix + '/routes/v0/transaction_types'),
  v0ClientUsersRoutes = require(rootPrefix + '/routes/v0/client_users'),
  v1Routes = require(rootPrefix + '/routes/v1/index'),
  v1Dot1Routes = require(rootPrefix + '/routes/v1.1/index'),
  internalRoutes = require(rootPrefix + '/routes/internal/index'),
  inputValidator = require(rootPrefix + '/lib/authentication/validate_signature'),
  logger = require(rootPrefix + '/lib/logger/custom_console_logger'),
  notifier = require(rootPrefix + '/helpers/notifier'),
  customMiddleware = require(rootPrefix + '/helpers/custom_middleware'),
  SystemServiceStatusesCacheKlass = require(rootPrefix + '/lib/shared_cache_management/system_service_statuses'),
  apiVersions = require(rootPrefix + '/lib/global_constant/api_versions'),
  basicHelper = require(rootPrefix + '/helpers/basic'),
  errorConfig = basicHelper.fetchErrorConfig(apiVersions.internal);

const requestSharedNameSpace = createNamespace('openST-Platform-NameSpace'),
  systemServiceStatusesCache = new SystemServiceStatusesCacheKlass({});

morgan.token('id', function getId(req) {
  return req.id;
});

morgan.token('endTime', function getendTime(req) {
  var hrTime = process.hrtime();
  return hrTime[0] * 1000 + hrTime[1] / 1000000;
});
morgan.token('endDateTime', function getEndDateTime(req) {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    (d.getMonth() + 1) +
    '-' +
    d.getDate() +
    ' ' +
    d.getHours() +
    ':' +
    d.getMinutes() +
    ':' +
    d.getSeconds() +
    '.' +
    d.getMilliseconds()
  );
});

const assignParams = function(req) {
  logger.requestStartLog(customUrlParser.parse(req.originalUrl).pathname, req.method);

  if (req.method == 'POST') {
    req.decodedParams = req.body;
  } else if (req.method == 'GET') {
    req.decodedParams = req.query;
  }
};

const validateApiSignature = function(req, res, next) {
  assignParams(req);

  const handleParamValidationResult = function(result) {
    if (result.isSuccess()) {
      req.decodedParams['client_id'] = result.data['clientId'];
      next();
    } else {
      return responseHelper
        .error({
          internal_error_identifier: 'a_1',
          api_error_identifier: 'unauthorized_api_request',
          debug_options: {}
        })
        .renderResponse(res, errorConfig);
    }
  };

  return inputValidator
    .perform(req.decodedParams, customUrlParser.parse(req.originalUrl).pathname)
    .then(handleParamValidationResult);
};

// before action for verifying the jwt token and setting the decoded info in req obj
const decodeJwt = function(req, res, next) {
  logger.requestStartLog(customUrlParser.parse(req.originalUrl).pathname, req.method);

  if (req.method == 'POST') {
    var token = req.body.token || '';
  } else if (req.method == 'GET') {
    var token = req.query.token || '';
  }

  // Set the decoded params in the re and call the next in control flow.
  const jwtOnResolve = function(reqParams) {
    req.decodedParams = reqParams.data;
    // Validation passed.
    return next();
  };

  // send error, if token is invalid
  const jwtOnReject = function(err) {
    return responseHelper
      .error({
        internal_error_identifier: 'a_2',
        api_error_identifier: 'invalid_or_expired_token',
        debug_options: {}
      })
      .renderResponse(res, errorConfig);
  };

  // Verify token
  Promise.resolve(jwtAuth.verifyToken(token, 'saasApi').then(jwtOnResolve, jwtOnReject)).catch(function(err) {
    notifier.notify('a_3', 'JWT Decide Failed', { token: token });
    return responseHelper
      .error({
        internal_error_identifier: 'a_3',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      })
      .renderResponse(res, errorConfig);
  });
};

// Set request debugging/logging details to shared namespace
const appendRequestDebugInfo = function(req, res, next) {
  requestSharedNameSpace.run(function() {
    requestSharedNameSpace.set('reqId', req.id);
    requestSharedNameSpace.set('startTime', req.startTime);
    next();
  });
};

// check system service statuses and return error if they are down
const checkSystemServiceStatuses = async function(req, res, next) {
  if (req.method === 'POST') {
    var rParams = req.body;
  } else {
    var rParams = req.query;
  }

  if (
    rParams &&
    rParams.api_key &&
    ['67ac5a9b79f49bcdba5e', '02db2e7059d66d8e83f2', '771044c4e1f943eb1f77'].includes(rParams.api_key)
  ) {
    logger.info('Bypassing system maintainence checks for', rParams.api_key);
    return next();
  }

  const statusRsp = await systemServiceStatusesCache.fetch();
  if (statusRsp.isSuccess && statusRsp.data && statusRsp.data['saas_api_available'] != 1) {
    return responseHelper
      .error({
        internal_error_identifier: 'a_4',
        api_error_identifier: 'api_under_maintenance',
        debug_options: {}
      })
      .renderResponse(res, errorConfig);
  }

  next();
};

const appendInternalVersion = function(req, res, next) {
  req.decodedParams.apiVersion = apiVersions.internal;
  next();
};

const appendV0Version = function(req, res, next) {
  req.decodedParams.apiVersion = apiVersions.v0;
  next();
};

const appendV1Version = function(req, res, next) {
  req.decodedParams.apiVersion = apiVersions.v1;
  next();
};

const appendV1Dot1Version = function(req, res, next) {
  req.decodedParams.apiVersion = apiVersions.v1Dot1;
  next();
};

const killMasterIfAllWorkersDied = function() {
  if (onlineWorker == 0) {
    console.log('Killing master as all workers are died.');
    process.exit(1);
  }
};

// if the process is a master.
if (cluster.isMaster) {
  // Set worker process title
  process.title = 'Company Restful API node master';

  // Fork workers equal to number of CPUs
  const numWorkers = process.env.OST_CACHING_ENGINE == 'none' ? 1 : process.env.WORKERS || require('os').cpus().length;

  for (var i = 0; i < numWorkers; i++) {
    // Spawn a new worker process.
    cluster.fork();
  }

  // Worker started listening and is ready
  cluster.on('listening', function(worker, address) {
    logger.info(`[worker-${worker.id} ] is listening to ${address.port}`);
  });
  var onlineWorker = 0;
  // Worker came online. Will start listening shortly
  cluster.on('online', function(worker) {
    logger.info(`[worker-${worker.id}] is online`);
    // when a worker comes online, increment the online worker count
    onlineWorker = onlineWorker + 1;
  });

  //  Called when all workers are disconnected and handles are closed.
  cluster.on('disconnect', function(worker) {
    notifier.notify('a_3', `[worker-${worker.id}] is disconnected`);
    // when a worker disconnects, decrement the online worker count
    onlineWorker = onlineWorker - 1;
  });

  // When any of the workers die the cluster module will emit the 'exit' event.
  cluster.on('exit', function(worker, code, signal) {
    if (worker.exitedAfterDisconnect === true) {
      // don't restart worker as voluntary exit
      logger.info(`[worker-${worker.id}] voluntary exit. signal: ${signal}. code: ${code}`);
    } else {
      // restart worker as died unexpectedly
      notifier.notify(code, `[worker-${worker.id}] restarting died. signal: ${signal}. code: ${code}`);
      cluster.fork();
    }
  });
  // Exception caught
  process.on('uncaughtException', function(err) {
    notifier.notify('app_crash_1', 'app server exited unexpectedly. Reason: ', err);
    process.exit(1);
  });
  // When someone try to kill the master process
  // kill <master process id>
  process.on('SIGTERM', function() {
    for (var id in cluster.workers) {
      cluster.workers[id].exitedAfterDisconnect = true;
    }
    setInterval(killMasterIfAllWorkersDied, 10);
    cluster.disconnect(function() {
      logger.info('Master received SIGTERM. Killing/disconnecting it.');
    });
  });
} else if (cluster.isWorker) {
  // if the process is not a master

  // Set worker process title
  process.title = 'Company Restful API node worker-' + cluster.worker.id;

  // Create express application instance
  const app = express();

  // Load custom middleware and set the worker id
  app.use(customMiddleware({ worker_id: cluster.worker.id }));
  // Load Morgan
  app.use(
    morgan(
      '[:id][:endTime] Completed with ":status" in :response-time ms at :endDateTime -  ":res[content-length] bytes" - ":remote-addr" ":remote-user" - "HTTP/:http-version :method :url" - ":referrer" - ":user-agent"'
    )
  );

  app.use(helmet());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, 'public')));

  /*
    The sanitizer() piece of code should always be before routes for jwt and after validateApiSignature for sdk.
    Docs: https://www.npmjs.com/package/express-sanitized
  */

  // Following are the routes
  app.use('/', internalRoutes);

  app.use(
    '/internal',
    sanitizer(),
    checkSystemServiceStatuses,
    appendRequestDebugInfo,
    decodeJwt,
    appendInternalVersion,
    internalRoutes
  );

  app.use(
    '/v1',
    checkSystemServiceStatuses,
    appendRequestDebugInfo,
    validateApiSignature,
    sanitizer(),
    appendV1Version,
    v1Routes
  );

  app.use(
    '/v1.1',
    checkSystemServiceStatuses,
    appendRequestDebugInfo,
    validateApiSignature,
    sanitizer(),
    appendV1Dot1Version,
    v1Dot1Routes
  );

  app.use(
    '/transaction-types',
    checkSystemServiceStatuses,
    appendRequestDebugInfo,
    validateApiSignature,
    sanitizer(),
    appendV0Version,
    v0TransactionRoutes
  );

  app.use(
    '/users',
    checkSystemServiceStatuses,
    appendRequestDebugInfo,
    validateApiSignature,
    sanitizer(),
    appendV0Version,
    v0ClientUsersRoutes
  );

  // catch 404 and forward to error handler
  app.use(function(req, res, next) {
    logger.requestStartLog(customUrlParser.parse(req.originalUrl).pathname, req.method);
    return responseHelper
      .error({
        internal_error_identifier: 'a_5',
        api_error_identifier: 'resource_not_found',
        debug_options: {}
      })
      .renderResponse(res, errorConfig);
  });

  // error handler
  app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    notifier.notify('a_6', 'Something went wrong', err);
    return responseHelper
      .error({
        internal_error_identifier: 'a_6',
        api_error_identifier: 'something_went_wrong',
        debug_options: {}
      })
      .renderResponse(res, errorConfig);
  });

  /**
   * Get port from environment and store in Express.
   */

  var port = normalizePort(process.env.PORT || '7001');
  app.set('port', port);

  /**
   * Create HTTP server.
   */

  var server = http.createServer(app);

  /**
   * Listen on provided port, on all network interfaces.
   */

  server.listen(port, 443);
  server.on('error', onError);
  server.on('listening', onListening);
}

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  let bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      notifier.notify('a_6', bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      notifier.notify('a_7', bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  let addr = server.address();
  var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
}
