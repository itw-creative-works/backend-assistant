let _ = require('lodash');
let JSON5;

function BackendAssistant() {
  this.meta = {};
}

function tryParse(input) {
  var ret;
  try {
    ret = JSON.parse(input);
  } catch (e) {
    ret = input
  }
  return ret;
}

BackendAssistant.prototype.init = function (ref, options) {
  options = options || {};
  options.accept = options.accept || 'json';
  options.showOptionsLog = typeof options.showOptionsLog !== 'undefined' ? options.showOptionsLog : false;

  this.meta = {};

  this.meta.startTime = {};
  this.meta.startTime.timestamp = new Date().toISOString();
  this.meta.startTime.timestampUNIX = Math.floor((+new Date(this.meta.startTime.timestamp)) / 1000);

  this.meta.name = options.name || process.env.FUNCTION_TARGET || 'unnamed';
  this.meta.environment = options.environment || (process.env.TERM_PROGRAM == 'Apple_Terminal' ? "development" : "production");
  this.meta.type = process.env.FUNCTION_SIGNATURE_TYPE;

  this.ref = {};
  ref = ref || {};
  this.ref.res = ref.res || {};
  this.ref.req = ref.req || {};
  this.ref.admin = ref.admin || {};
  this.ref.functions = ref.functions || {};

  // Set stuff about request
  this.request = {};
  this.request.referrer = (this.ref.req.headers || {}).referrer || (this.ref.req.headers || {}).referer || '';
  this.request.method = (this.ref.req.method || 'undefined');
  this.request.ip = getHeaderIp(this.ref.req.headers);
  this.request.country = getHeaderCountry(this.ref.req.headers);
  this.request.type = (this.ref.req.xhr || _.get(this.ref.req, 'headers.accept', '').indexOf('json') > -1) || (_.get(this.ref.req, 'headers.content-type', '').indexOf('json') > -1) ? 'ajax' : 'form';
  this.request.path = (this.ref.req.path || '');
  this.request.user = require('./user.json');

  if (options.accept == 'json') {
    this.request.body = tryParse(this.ref.req.body || '{}');
    this.request.query = tryParse(this.ref.req.query || '{}');
  }

  this.request.headers = (this.ref.req.headers || {});
  this.request.data = Object.assign({}, this.request.body || {}, this.request.query || {});

  // Constants
  this.constant = {};
  this.constant.pastTime = {};
  this.constant.pastTime.timestamp = '1999-01-01T00:00:00Z';
  this.constant.pastTime.timestampUNIX = 915148800;

  if ((this.meta.environment == 'development') && (this.request.method != 'OPTIONS' || (this.request.method == 'OPTIONS' && options.showOptionsLog))) {
    console.log(''); console.log(''); console.log(''); console.log(''); console.log('');
    // console.log(`---${this.meta.name}--- ${this.request.method}`);
    // this.log('this.ref.req.headers',this.ref.req.headers)
    // console.log('this.ref.req.body', typeof this.ref.req.body, this.ref.req.body.slap_email, JSON.stringify(this.ref.req.body), );
    // console.log('this.ref.req.query', typeof this.ref.req.query, this.ref.req.query.slap_email, JSON.stringify(this.ref.req.query), );
    // console.log('this.request.type',this.request.type);
    // console.log('this.request.method',this.request.method);
  }
  return this;

};

BackendAssistant.prototype.logProd = function () {
  let self = this;
  // log.apply(self, args);
  self._log.apply(this, args);
};

// BackendAssistant.prototype.wait = function (ms) {
//   return new Promise(function(resolve, reject) {
//     setTimeout(function () {
//       resolve({waited: ms});
//     }, ms || 1);
//   });
// };

BackendAssistant.prototype.log = function () {
  let self = this;
  let args = Array.prototype.slice.call(arguments);
  let last = args[args.length - 1];
  let runEnv = 'development';
  if (typeof last === 'object' && !Array.isArray(last)) {
    runEnv = typeof last.environment !== 'undefined' ? last.environment : 'development';
  }
  if (self.meta.environment == 'development' || runEnv == 'production') {
    // 1. Convert args to a normal array
    args.pop();

    self._log.apply(this, args);
  }
};

BackendAssistant.prototype._log = function() {
  let self = this;

  // 1. Convert args to a normal array
  let args = Array.prototype.slice.call(arguments);
  let logs = [];

  // convert objects to strings if in development
  for (var i = 0, l = args.length; i < l; i++) {
    if (args[i] instanceof Error) {
      console.error(args[i]);
      continue;
    }
    logs = logs.concat(typeof args[i] === 'object'
      ? tryLogPrep(args[i], self.meta.environment)
      : args[i]);
  }

  // 2. Prepend log prefix log string
  logs.unshift(`[${self.meta.name} ${self.meta.startTime.timestamp}] >`);

  // 3. Pass along arguments to console.log
  if (logs[1] == 'error') {
    logs.splice(1,1)
    console.error.apply(console, logs);
  } else if (logs[1] == 'warn') {
    logs.splice(1,1)
    console.warn.apply(console, logs);
  } else if (logs[1] == 'log') {
    logs.splice(1,1)
    console.log.apply(console, logs);
  } else {
    console.log.apply(console, logs);
  }

}

BackendAssistant.prototype.authorize = async function () {
  let self = this;
  let admin = self.ref.admin;
  let functions = self.ref.functions;
  let req = self.ref.req;
  let res = self.ref.res;
  let data = self.request.data;
  let idToken;

  if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer '))
    && !(req.cookies && req.cookies.__session)
    && !(data.backendManagerKey)
    && !(data.authenticationToken)
  ) {
    self.log('No Firebase ID token was passed as a Bearer token in the Authorization header.',
      'Make sure you authorize your request by providing the following HTTP header:',
      'Authorization: Bearer <Firebase ID Token>',
      'or by passing a "__session" cookie.');

    return self.request.user;
  }

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    self.log('Found "Authorization" header');
    // Read the ID Token from the Authorization header.
    idToken = req.headers.authorization.split('Bearer ')[1];
  } else if(req.cookies) {
    self.log('Found "__session" cookie');
    // Read the ID Token from cookie.
    idToken = req.cookies.__session;
  } else if (data.backendManagerKey) {
    idToken = data.backendManagerKey;
  } else if (data.authenticationToken) {
    idToken = data.authenticationToken;
  } else {
    // No cookie
    return self.request.user;
  }

  // Check with custom BEM Token
  let storedApiKey = functions.config().backend_manager ? functions.config().backend_manager.key : '';
  if (storedApiKey === idToken) {
    self.request.user.authorized = true;
    self.request.user.roles.admin = true;
    return self.request.user;
  }

  // Check with firebase
  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    self.log('Token correctly decoded', decodedIdToken.email, decodedIdToken.user_id);
    await admin.firestore().doc(`users/${decodedIdToken.user_id}`)
    .get()
    .then(async function (doc) {
      if (doc.exists) {
        self.request.user = doc.data();
      }
      self.request.user.authorized = true;
      self.request.user.firebase.uid = decodedIdToken.user_id;
      self.request.user.firebase.email = decodedIdToken.email;
      self.log('Found user doc', self.request.user)
    })
    return self.request.user;
  } catch (error) {
    self.log('Error while verifying Firebase ID token:', error);
    return self.request.user;
  }
};

BackendAssistant.prototype.parseRepo = function (repo) {
  let repoSplit = repo.split('/');
  for (var i = 0; i < repoSplit.length; i++) {
    repoSplit[i] = repoSplit[i].replace('.git', '');
  }
  repoSplit = repoSplit.filter(function(value, index, arr){
      return value != 'http:' &&
             value != 'https:' &&
             value != '' &&
             value != 'github.com';
  });
  return {
    user: repoSplit[0],
    name: repoSplit[1],
  }
};

function stringify(obj, replacer, spaces, cycleReplacer) {
  return JSON.stringify(obj, serializer(replacer, cycleReplacer), spaces)
}

// https://github.com/moll/json-stringify-safe/blob/master/stringify.js
function serializer(replacer, cycleReplacer) {
  var stack = [], keys = []

  if (cycleReplacer == null) cycleReplacer = function(key, value) {
    if (stack[0] === value) return "[Circular ~]"
    return "[Circular ~." + keys.slice(0, stack.indexOf(value)).join(".") + "]"
  }

  return function(key, value) {
    if (stack.length > 0) {
      var thisPos = stack.indexOf(this)
      ~thisPos ? stack.splice(thisPos + 1) : stack.push(this)
      ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key)
      if (~stack.indexOf(value)) value = cycleReplacer.call(this, key, value)
    }
    else stack.push(value)

    return replacer == null ? value : replacer.call(this, key, value)
  }
}

function getHeaderCountry(headers) {
  let ret = '';
  try {
    ret =
      headers['cf-ipcountry'] ||
      'unknown';
  } catch (e) {
    ret = 'unknown';
    console.error(e);
  }
  return ret;
}


function getHeaderIp(headers) {
  let ret = '';
  try {
    ret =
      headers['cf-connecting-ip'] ||
      headers['x-appengine-user-ip'] ||
      (headers['x-forwarded-for'] || '').split(',').pop() ||
      '127.0.0.1';
  } catch (e) {
    ret = '127.0.0.1';
    console.error(e);
  }
  return ret;
}

function tryLogPrep(obj, environment) {
  let result;
  JSON5 = JSON5 || require('json5');
  try {
    result = environment === 'development'
      ? JSON5.stringify(obj, null, 2)
      : JSON5.stringify(obj)
  } catch (e) {
  } finally {
    return result || obj;
  }
}

module.exports = BackendAssistant;
