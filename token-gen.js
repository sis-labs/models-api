const { v4: uuid } = require('uuid');
const nJwt = require('njwt');
const moment = require('moment');
const secret = 'ce0d86934ee9585417502bcee777e832c461241811355934079e24253b1cd1e5';
const alg = 'HS256';

var claims = {
  "sub": uuid(),
  "name": "jdoe",
  "holding": "gm",
  "scopes": [ "admin", "user:read", "user:write", "models:read", "models:write"],
  jti: uuid(),
  iat:  moment().unix()
  exp: moment().add(7,'d').unix()
};

const jwt = nJwt.create(claims, secret, alg);

const token = jwt.compact();
