"use strict";
/*
 * Main application file
 *
 * * Author: Rachin
 * * Date: 23/10/2017
 * * Reviewed by: Sunil
 */
const express = require('express')
  , path = require('path')
  , createNamespace = require('continuation-local-storage').createNamespace
  , requestSharedNameSpace = createNamespace('company-Saas-NameSpace')
  , morgan = require('morgan')
  , cookieParser = require('cookie-parser')
  , bodyParser = require('body-parser')
  , helmet = require('helmet')
  , sanitizer = require('express-sanitized')
  , customUrlParser = require('url')
  , cluster = require('cluster')
  , http = require('http')
;

const rootPrefix = '.'
  , jwtAuth = require(rootPrefix + '/lib/jwt/jwt_auth')
  , responseHelper = require(rootPrefix + '/lib/formatter/response')
  , transactionRoutes = require(rootPrefix + '/routes/transaction')
  , onBoardingRoutes = require(rootPrefix + '/routes/on_boarding')
  , stakeRoutes = require(rootPrefix + '/routes/stake')
  , clientUsersRoutes = require(rootPrefix + '/routes/client_users')
  , addressRoutes = require(rootPrefix + '/routes/address')
  , inputValidator = require(rootPrefix + '/lib/authentication/validate_signature')
  , logger = require(rootPrefix + '/lib/logger/custom_console_logger')
;

morgan.token('id', function getId (req) {
  return req.id;
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
    console.error(err);
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
    console.error(err);
    responseHelper.error('a_2', 'Something went wrong').renderResponse(res)
  });

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
    logger.error(`[worker-${worker.id}] is disconnected`);
  });

  // When any of the workers die the cluster module will emit the 'exit' event.
  cluster.on('exit', function(worker, code, signal) {
    if (worker.exitedAfterDisconnect === true) {
      // don't restart worker as voluntary exit
      logger.info(`[worker-${worker.id}] voluntary exit. signal: ${signal}. code: ${code}`);
    } else {
      // restart worker as died unexpectedly
      logger.error(`[worker-${worker.id}] restarting died. signal: ${signal}. code: ${code}`, worker.id, signal, code);
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

  // Load Morgan
  app.use(morgan('[:id] :remote-addr - :remote-user [:date[clf]] :method :url :response-time HTTP/:http-version" :status :res[content-length] :referrer :user-agent'));

  // Set request debugging/logging details to shared namespace
  app.use(function(req, res, next) {
    requestSharedNameSpace.run(function() {
      requestSharedNameSpace.set('reqId', req.id);
      requestSharedNameSpace.set('workerId', cluster.worker.id);
      var hrTime = process.hrtime();
      requestSharedNameSpace.set('startTime', hrTime);
      next();
    });
  });

  app.use(helmet());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, 'public')));

  /*
    The below piece of code should always be before routes.
    Docs: https://www.npmjs.com/package/express-sanitized
  */
  app.use(sanitizer());

  // Following are the routes
  app.use('/transaction', validateApiSignature, transactionRoutes);

  app.use('/users', validateApiSignature, clientUsersRoutes);

  app.use('/addresses', validateApiSignature, addressRoutes);

  app.use('/on-boarding', decodeJwt, onBoardingRoutes);

  app.use('/stake', decodeJwt, stakeRoutes);

// catch 404 and forward to error handler
  app.use(function (req, res, next) {
    return responseHelper.error('404', 'Not Found').renderResponse(res, 404);
  });

// error handler
  app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    console.error(err);
    return responseHelper.error('500', 'Something went wrong').renderResponse(res, 500);
  });

  /**
   * Get port from environment and store in Express.
   */

  var port = normalizePort(process.env.PORT || '3000');
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
      logger.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(bind + ' is already in use');
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
