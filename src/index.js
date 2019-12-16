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

  this.meta.name = options.name || 'unnamed';
  this.meta.environment = options.environment || (process.env.TERM_PROGRAM == 'Apple_Terminal' ? "development" : "production")

  this.refs = {};
  options.refs = options.refs || {};
  this.refs.res = options.refs.res || {};
  this.refs.req = options.refs.req || {};
  this.refs.admin = options.refs.admin || {};

  // Set stuff about request
  this.request = {};
  this.request.referrer = (this.refs.req.headers || {}).referrer || (this.refs.req.headers || {}).referer || '';
  this.request.method = (this.refs.req.method || 'undefined');
  this.request.ip = getHeaderIp(this.refs.req.headers);
  this.request.country = getHeaderCountry(this.refs.req.headers);
  this.request.type = (this.refs.req.xhr || _.get(this.refs.req, 'headers.accept', '').indexOf('json') > -1) || (_.get(this.refs.req, 'headers.content-type', '').indexOf('json') > -1) ? 'ajax' : 'form';
  this.request.path = (this.refs.req.path || '');

  if (options.accept == 'json') {
    this.request.body = tryParse(this.refs.req.body || '{}');
    this.request.query = tryParse(this.refs.req.query || '{}');
  }

  this.request.headers = (this.refs.req.headers || {});
  this.request.data = Object.assign({}, this.request.body || {}, this.request.query || {});

  // Constants
  this.constant = {};
  this.constant.pastTime = {};
  this.constant.pastTime.timestamp = '1999-01-01T00:00:00Z';
  this.constant.pastTime.timestampUNIX = 915148800;

  if ((this.meta.environment == 'development') && (this.request.method != 'OPTIONS' || (this.request.method == 'OPTIONS' && options.showOptionsLog))) {
    console.log(''); console.log(''); console.log(''); console.log(''); console.log('');
    console.log(`---${this.meta.name}--- ${this.request.method}`);
    // this.log('this.refs.req.headers',this.refs.req.headers)
    // console.log('this.refs.req.body', typeof this.refs.req.body, this.refs.req.body.slap_email, JSON.stringify(this.refs.req.body), );
    // console.log('this.refs.req.query', typeof this.refs.req.query, this.refs.req.query.slap_email, JSON.stringify(this.refs.req.query), );
    // console.log('this.request.type',this.request.type);
    // console.log('this.request.method',this.request.method);
  }

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
