const restify = require('restify');
const bunyan = require('bunyan');
const moment = require('moment');
const jwt = require('jsonwebtoken');

const appName = 'modelsApi';
const appId = 'models-api';
const {version: appVersion} = require('./package.json');
const jwtSecret = 'ce0d86934ee9585417502bcee777e832c461241811355934079e24253b1cd1e5';

function requestSerializer(req) {
  const origin = req.header('host');
  const userAgent = req.userAgent();
  const queryString = req.getQuery();
  const id = req.id();
  const {
    method,
    path: url
  } = req.getRoute();
  return {
    method,
    id,
    queryString,
    url,
    origin,
    userAgent
  }
}

function contextSerializer(ctx) {
  const {authorization} = ctx;
  const token = jwt.decode(authorization);
  const {user, holding, appId, client_id:clientId, client_secret: clientSecret} = jwt.payload;
  return {
    user,
    holding,
    appId,
    clientId,
    clientSecret
  }
}

const log = bunyan.createLogger({
  name: appName,
  streams: [
    {
      level: 'debug',
      stream: process.stdout
    }
  ],
  serializers: {
    req: requestSerializer,
    ctx: contextSerializer
  }
});

const perfLogger = bunyan.createLogger({
  name: `${appName}PerfLogger}`,
  streams: [
    {
      level: 'info',
      stream: process.stdout
    }
  ],
  serializers: {
    req: requestSerializer
  }
});

const server = restify.createServer({
  name: appName,
  version: appVersion,
  log
});

const {PORT = 4400, HOST = "0.0.0.0" } = process.env;

const acceptedMethods = "GET, POST, HEAD, PUT, PATCH, OPTIONS, DELETE";
const acceptedHeaders = 'x-request-id, content-type, x-application-id, x-issuer-id';

server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());

function now() {
  return moment().valueOf();
}

function fillCorsHeaders(req, res) {
  const host = req.header('origin');
  res.header('Access-Control-Allow-Origin', host);
  res.header('Access-Control-Allow-Methods', acceptedMethods);
  res.header('Access-Control-Allow-Headers', acceptedHeaders);
  res.header('Access-Control-Max-Age', '86400');
  return {
    req,
    res
  };
}

function marshalRequest(req) {
  let cache = [];
  const str = JSON.stringify(req, function(key, value) {
    if (typeof value === 'object' && value !== null) {
      if (cache.indexOf(value) !== -1) {
          // Circular reference found, discard key
          return;
      }
      // Store value in our collection                
      cache.push(value);
    }
    return value;
  });
  cache = null;
  return str;
}

server.on('pre', (req, res) => {
  req.log.info({req}, 'Handling a new request');
  const authorization = req.header('authorization');
  const token = authorization.split(" ")[1];
  try {
    req.log.info({req}, 'Trying to verify the jwt token');
    jwt.verify(token, jwtSecret);
    req.log.info({req}, 'The token has been succesfully verified');
    const {jwtHeader, jwtPayload} = jwt.decode(token, {complete : true});
    const { url, method } = req;
    if (method !== 'OPTIONS') {
      fillCorsHeaders(req, res);
    }
  } catch(err) {
    req.log.error({req}, 'Unable to verify the token [' + (err.message || err) + ']');
    res.send(401, {code: 02, message: 'invalid token'}, {'x-request-id': req.id(), 'x-response-time': moment().valueOf() - req.time()});
  }
});

server.on('after', (req, res, route, error) => {
  duration = now() - req.time();
  perfLogger.info({req, duration}, `Request processing duration ${duration}`);
  if (typeof error !== 'undefined') {
    server.log.error(error);
  }
});

server.opts('/models', (req, res, next) => {
  req.log.info('Handling a request for options on /models');
  fillCorsHeaders(req, res);
  return next();
});

server.get('/models', (req, res, next) => {
  req.log.info({req}, 'Handling a request for listing all models');
  const id = req.id();
  const headers = {
    'x-request-id': id,
    'x-response-time': '20'
  };
  res.json(200, [], headers);
  return next();
});

server.get('/models/:name', (req, res, next) => {
  req.log.info({req}, 'Handling a request for listing models');
  const id = req.id();
  const headers = {
    'x-request-id': id,
    'x-response-time': '20'
  };
  res.json(200, {}, headers);
  return next();
});

server.listen(PORT, HOST, () => {
  server.log.info('Server started: %s listening at %s', server.name, server.url);
});

server.close(() => {
  server.log.info('Server is shutdowing');
});
