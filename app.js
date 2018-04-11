"use strict";
/*
 * Main application file
 *
 * * Author: Rachin
 * * Date: 23/10/2017
 * * Reviewed by: Sunil
 */

const rootPrefix = '.'
;

//Always Include Module overrides First
require(rootPrefix + '/module_overrides/index');

const express = require('express')
  , path = require('path')
  , createNamespace = require('continuation-local-storage').createNamespace
  , requestSharedNameSpace = createNamespace('openST-Platform-NameSpace')
  , morgan = require('morgan')
  , cookieParser = require('cookie-parser')
  , bodyParser = require('body-parser')
  , helmet = require('helmet')
  , sanitizer = require('express-sanitized')
  , customUrlParser = require('url')
  , cluster = require('cluster')
  , http = require('http')
;

const rootRoutes = require(rootPrefix + '/routes/root')
  , jwtAuth = require(rootPrefix + '/lib/jwt/jwt_auth')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , transactionRoutes = require(rootPrefix + '/routes/transaction_types')
  , onBoardingRoutes = require(rootPrefix + '/routes/on_boarding')
  , stakeRoutes = require(rootPrefix + '/routes/stake')
  , clientUsersRoutes = require(rootPrefix + '/routes/client_users')
  , clientUsersJwtRoutes = require(rootPrefix + '/routes/client_users_jwt')
  , clientRoutes = require(rootPrefix + '/routes/client')
  , simulatorRoutes = require(rootPrefix + '/routes/simulator')
  , inputValidator = require(rootPrefix + '/lib/authentication/validate_signature')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
  , customMiddleware = require(rootPrefix + '/helpers/custom_middleware')
  , SystemServiceStatusesCacheKlass = require('./lib/cache_management/system_service_statuses')
  , systemServiceStatusesCache = new SystemServiceStatusesCacheKlass({})
;

morgan.token('id', function getId (req) {
  return req.id;
});

morgan.token('endTime', function getendTime (req) {
  var hrTime = process.hrtime();
  return (hrTime[0] * 1000 + hrTime[1] / 1000000);
});
morgan.token('endDateTime', function getEndDateTime (req) {
  const d = new Date()
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate() + " " + d.getHours() + ":" +
    d.getMinutes() + ":" + d.getSeconds() + "." + d.getMilliseconds();
});

const assignParams = function (req) {
  logger.requestStartLog(customUrlParser.parse(req.originalUrl).pathname, req.method);
  if (req.method == 'POST') {
    req.decodedParams = req.body;
  } else if (req.method == 'GET') {
    req.decodedParams = req.query;
  }
};

const validateApiSignature = function (req, res, next){
  assignParams(req);

  const handleParamValidationResult = function(result) {
    if(result.isSuccess()){
      req.decodedParams["client_id"] = result.data["clientId"];
      next();
    } else {
      return responseHelper.error('401', 'Unauthorized').renderResponse(res, 401);
    }
  };

  return inputValidator.perform(req.decodedParams, customUrlParser.parse(req.originalUrl).pathname)
    .then(handleParamValidationResult);
};

// before action for verifying the jwt token and setting the decoded info in req obj
const decodeJwt = function(req, res, next) {
  assignParams(req);

  var token = req.decodedParams.token;
  if(!token){
    return next();
  }

  // Set the decoded params in the re and call the next in control flow.
  const jwtOnResolve = function (reqParams) {
    req.decodedParams = reqParams.data;
    // Validation passed.
    return next();
  };

  // send error, if token is invalid
  const jwtOnReject = function (err) {
    logger.notify('a_1', 'Invalid token or expired', err);
    return responseHelper.error('a_1', 'Invalid token or expired').renderResponse(res);
  };

  // Verify token
  Promise.resolve(
    jwtAuth.verifyToken(token, 'saasApi')
      .then(
        jwtOnResolve,
        jwtOnReject
      )
  ).catch(function (err) {
    logger.notify('a_2', 'Something went wrong', err);
    responseHelper.error('a_2', 'Something went wrong').renderResponse(res)
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

  if (rParams && rParams.api_key && ['67ac5a9b79f49bcdba5e', '02db2e7059d66d8e83f2', '771044c4e1f943eb1f77'].includes(rParams.api_key)) {
    logger.info('Bypassing system maintainence checks for', rParams.api_key);
    return next();
  }

  const statusRsp = await systemServiceStatusesCache.fetch();
  if (statusRsp.isSuccess && statusRsp.data && statusRsp.data['saas_api_available'] != 1) {
    return responseHelper.error('a_4', 'API Under Maintenance').renderResponse(res, 503);
  }

  next();

};

// if the process is a master.
if (cluster.isMaster) {
  // Set worker process title
  process.title = "Company Restful API node master";

  // Fork workers equal to number of CPUs
  const numWorkers = (process.env.OST_CACHING_ENGINE=='none' ? 1 : (process.env.WORKERS || require('os').cpus().length));

  for (var i = 0; i < numWorkers; i++) {
    // Spawn a new worker process.
    cluster.fork();
  }

  // Worker started listening and is ready
  cluster.on('listening', function(worker, address) {
    logger.info(`[worker-${worker.id} ] is listening to ${address.port}`);
  });

  // Worker came online. Will start listening shortly
  cluster.on('online', function(worker) {
    logger.info(`[worker-${worker.id}] is online`);
  });

  //  Called when all workers are disconnected and handles are closed.
  cluster.on('disconnect', function(worker) {
    logger.notify('a_3', `[worker-${worker.id}] is disconnected`);
  });

  // When any of the workers die the cluster module will emit the 'exit' event.
  cluster.on('exit', function(worker, code, signal) {
    if (worker.exitedAfterDisconnect === true) {
      // don't restart worker as voluntary exit
      logger.info(`[worker-${worker.id}] voluntary exit. signal: ${signal}. code: ${code}`);
    } else {
      // restart worker as died unexpectedly
      logger.notify(code, `[worker-${worker.id}] restarting died. signal: ${signal}. code: ${code}`);
      cluster.fork();
    }
  });

  // When someone try to kill the master process
  // kill <master process id>
  process.on('SIGTERM', function() {
    for (var id in cluster.workers) {
      cluster.workers[id].exitedAfterDisconnect = true;
    }
    cluster.disconnect(function() {
      logger.info('Master received SIGTERM. Killing/disconnecting it.');
    });
  });

} else if (cluster.isWorker) {
  // if the process is not a master

  // Set worker process title
  process.title = "Company Restful API node worker-"+cluster.worker.id;

  // Create express application instance
  const app = express();

  // Load custom middleware and set the worker id
  app.use(customMiddleware({worker_id: cluster.worker.id}));
  // Load Morgan
  app.use(morgan('[:id][:endTime] Completed with ":status" in :response-time ms at :endDateTime -  ":res[content-length] bytes" - ":remote-addr" ":remote-user" - "HTTP/:http-version :method :url" - ":referrer" - ":user-agent"'));

  app.use(helmet());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, 'public')));

  /*
    The sanitizer() piece of code should always be before routes for jwt and after validateApiSignature for sdk.
    Docs: https://www.npmjs.com/package/express-sanitized
  */

  // Following are the routes
  app.use('/', rootRoutes);

  app.use('/transaction-types', checkSystemServiceStatuses, appendRequestDebugInfo, validateApiSignature, sanitizer(), transactionRoutes);

  app.use('/users', checkSystemServiceStatuses, appendRequestDebugInfo, validateApiSignature, sanitizer(), clientUsersRoutes);

  app.use('/on-boarding', sanitizer(), checkSystemServiceStatuses, appendRequestDebugInfo, decodeJwt, onBoardingRoutes);

  app.use('/stake', sanitizer(), checkSystemServiceStatuses, appendRequestDebugInfo, decodeJwt, stakeRoutes);

  app.use('/client', sanitizer(), checkSystemServiceStatuses, appendRequestDebugInfo, decodeJwt, clientRoutes);

  app.use('/simulator', sanitizer(), checkSystemServiceStatuses, appendRequestDebugInfo, decodeJwt, simulatorRoutes);

  app.use('/client-users', sanitizer(), checkSystemServiceStatuses, appendRequestDebugInfo, decodeJwt, clientUsersJwtRoutes);

// catch 404 and forward to error handler
  app.use(function (req, res, next) {
    logger.requestStartLog(customUrlParser.parse(req.originalUrl).pathname, req.method);
    return responseHelper.error('404', 'Not Found').renderResponse(res, 404);
  });

// error handler
  app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    logger.notify('a_5', 'Something went wrong', err);
    return responseHelper.error('500', 'Something went wrong').renderResponse(res, 500);
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

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      logger.notify('a_6', bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.notify('a_7', bind + ' is already in use');
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
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
}
