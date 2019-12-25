let _ = require('lodash');

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

BackendAssistant.prototype.init = function (options) {
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
  options.ref = options.ref || {};
  this.ref.res = options.ref.res || {};
  this.ref.req = options.ref.req || {};
  this.ref.admin = options.ref.admin || {};
  this.ref.functions = options.ref.functions || {};

  // Set stuff about request
  this.request = {};
  this.request.referrer = (this.ref.req.headers || {}).referrer || (this.ref.req.headers || {}).referer || '';
  this.request.method = (this.ref.req.method || 'undefined');
  this.request.ip = getHeaderIp(this.ref.req.headers);
  this.request.country = getHeaderCountry(this.ref.req.headers);
  this.request.type = (this.ref.req.xhr || _.get(this.ref.req, 'headers.accept', '').indexOf('json') > -1) || (_.get(this.ref.req, 'headers.content-type', '').indexOf('json') > -1) ? 'ajax' : 'form';
  this.request.path = (this.ref.req.path || '');
  this.request.isAdmin = undefined;

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
  let This = this;
  // log.apply(This, args);
  This._log.apply(this, args);
};

BackendAssistant.prototype.log = function () {
  let This = this;
  let args = Array.prototype.slice.call(arguments);
  let last = args[args.length - 1];
  let runEnv = 'development';
  if (typeof last === 'object' && !Array.isArray(last)) {
    runEnv = typeof last.environment !== 'undefined' ? last.environment : 'development';
  }
  if (This.meta.environment == 'development' || runEnv == 'production') {
    // 1. Convert args to a normal array
    let args = Array.prototype.slice.call(arguments);

    // log.apply(This, args);
    This._log.apply(this, args);
  }
};

BackendAssistant.prototype.wait = function (ms) {
  return new Promise(function(resolve, reject) {
    setTimeout(function () {
      resolve({waited: ms});
    }, ms || 1);
  });
};

BackendAssistant.prototype._log = function() {
  let This = this;
  // console.log('LOG INNER ENV', stringify(this));
  // console.log('LOG INNER ENV', this.meta.name);
  // // 1. Convert args to a normal array
  let args = Array.prototype.slice.call(arguments);

  // convert objects to strings if in development
  if (This.meta.environment == 'development') {
    for (var i = 0; i < args.length; i++) {
      if (typeof args[i] === 'object') {
        try {
          // args[i] = JSON.stringify(args[i], null, 2);
          // args[i] = stringify(Object.assign({}, args[i]), null, 2);
          args[i] = stringify(args[i], null, 2);
        } catch (e) {}
      }
    }
  };

  // 2. Prepend log prefix log string
  args.unshift(`[${This.meta.name} ${This.meta.startTime.timestamp}] >`);

  // 3. Pass along arguments to console.log
  if (args[1] == 'error') {
    args.splice(1,1)
    console.error.apply(console, args);
  } else if (args[1] == 'warn') {
    args.splice(1,1)
    console.warn.apply(console, args);
  } else if (args[1] == 'log') {
    args.splice(1,1)
    console.log.apply(console, args);
  } else {
    console.log.apply(console, args);
  }
}

BackendAssistant.prototype.authorizeAdmin = async function () {
  let This = this;
  let admin = this.ref.admin;
  let functions = this.ref.functions;
  let req = this.ref.req;
  let res = this.ref.res;
  let data = this.request.data;

  if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer '))
    && !(req.cookies && req.cookies.__session)
    && !(data.backendManagerKey)
  ) {
    console.error('No Firebase ID token was passed as a Bearer token in the Authorization header.',
      'Make sure you authorize your request by providing the following HTTP header:',
      'Authorization: Bearer <Firebase ID Token>',
      'or by passing a "__session" cookie.');
    this.request.isAdmin = false;
    return false;
  }

  let idToken;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    This.log('Found "Authorization" header');
    // Read the ID Token from the Authorization header.
    idToken = req.headers.authorization.split('Bearer ')[1];
  } else if(req.cookies) {
    This.log('Found "__session" cookie');
    // Read the ID Token from cookie.
    idToken = req.cookies.__session;
  } else if (data.backendManagerKey) {
    idToken = data.backendManagerKey;
  } else {
    // No cookie
    this.request.isAdmin = false;
    return false;
  }

  // Check with custom BEM Token
  let storedApiKey = functions.config().backend_manager ? functions.config().backend_manager.key : '';
  if (storedApiKey == idToken) {
    this.request.isAdmin = true;
    return true;
  }

  // Check with firebase
  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    This.log('Token correctly decoded', decodedIdToken.email, decodedIdToken.user_id);
    let status = false;
    await admin.firestore().doc(`users/${decodedIdToken.user_id}`)
    .get()
    .then(async function (doc) {
      if (doc.exists) {
        status = _.get(doc.data(), 'roles.admin', false)
      }
      This.log('Found user doc with roles.admin =', status)
    })
    this.request.isAdmin = status;
    return status;
  } catch (error) {
    This.log('Error while verifying Firebase ID token:', error);
    this.request.isAdmin = false;
    return false;
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

module.exports = BackendAssistant;
