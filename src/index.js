let _ = require('lodash');
let JSON5;

function BackendAssistant() {
  this.meta = {};
  this.initialized = false;
}

function tryParse(input) {
  JSON5 = JSON5 || require('json5');
  var ret;
  try {
    ret = JSON5.parse(input);
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

  this.meta.name = options.functionName || process.env.FUNCTION_TARGET || 'unnamed';
  this.meta.environment = options.environment || this.getEnvironment();
  this.meta.type = options.functionType || process.env.FUNCTION_SIGNATURE_TYPE || 'unknown';

  this.ref = {};
  ref = ref || {};
  this.ref.res = ref.res || {};
  this.ref.req = ref.req || {};
  this.ref.admin = ref.admin || {};
  this.ref.functions = ref.functions || {};
  this.ref.Manager = ref.Manager || {};

  // Set stuff about request
  this.request = {};
  this.request.referrer = (this.ref.req.headers || {}).referrer || (this.ref.req.headers || {}).referer || '';
  this.request.method = (this.ref.req.method || undefined);
  this.request.ip = this.getHeaderIp(this.ref.req.headers);
  this.request.country = this.getHeaderCountry(this.ref.req.headers);
  this.request.userAgent = this.getHeaderUserAgent(this.ref.req.headers);
  this.request.type = (this.ref.req.xhr || _.get(this.ref.req, 'headers.accept', '').indexOf('json') > -1) || (_.get(this.ref.req, 'headers.content-type', '').indexOf('json') > -1) ? 'ajax' : 'form';
  this.request.path = (this.ref.req.path || '');
  this.request.user = require('./user.json');
  if (options.accept === 'json') {
    this.request.body = tryParse(this.ref.req.body || '{}');
    this.request.query = tryParse(this.ref.req.query || '{}');
  }

  this.request.headers = (this.ref.req.headers || {});
  this.request.data = Object.assign(
    {},
    _.cloneDeep(this.request.body || {}),
    _.cloneDeep(this.request.query || {})
  );
  this.request.multipartData = {
    fields: {},
    files: {},
  };

  // Constants
  this.constant = {};
  this.constant.pastTime = {};
  this.constant.pastTime.timestamp = '1999-01-01T00:00:00Z';
  this.constant.pastTime.timestampUNIX = 915148800;

  if ((this.meta.environment === 'development') && ((this.request.method !== 'OPTIONS') || (this.request.method === 'OPTIONS' && options.showOptionsLog)) && (this.request.method !== 'undefined')) {
    console.log('\n\n\n\n\n');
  }

  this.initialized = true;

  return this;
};

BackendAssistant.prototype.getEnvironment = function () {
  // return (process.env.FUNCTIONS_EMULATOR === true || process.env.FUNCTIONS_EMULATOR === 'true' || process.env.ENVIRONMENT !== 'production' ? 'development' : 'production')
  if (process.env.ENVIRONMENT === 'production') {
    return 'production';
  } else if (process.env.ENVIRONMENT === 'development' || process.env.FUNCTIONS_EMULATOR === true || process.env.FUNCTIONS_EMULATOR === 'true' || process.env.TERM_PROGRAM === 'Apple_Terminal') {
    return 'development';
  } else {
    return 'production'
  }
};

BackendAssistant.prototype.logProd = function () {
  const self = this;
  self._log.apply(this, args);
};

BackendAssistant.prototype.log = function () {
  const self = this;
  let args = Array.prototype.slice.call(arguments);
  let last = args[args.length - 1];
  let override = (typeof last === 'object' && last.environment === 'production');
  if (self.meta.environment === 'development' || override) {
    if (override) {
      args.pop();
    }
    self._log.apply(this, args);
  }
};

BackendAssistant.prototype.error = function () {
  const self = this;
  let args = Array.prototype.slice.call(arguments);
  args.unshift('error');
  self.log.apply(self, args);
};

BackendAssistant.prototype._log = function() {
  const self = this;

  // 1. Convert args to a normal array
  let logs = [...Array.prototype.slice.call(arguments)];

  // 2. Prepend log prefix log string
  logs.unshift(`[${self.meta.name} ${self.meta.startTime.timestamp}] >`);

  // 3. Pass along arguments to console.log
  if (logs[1] === 'error') {
    logs.splice(1,1)
    console.error.apply(console, logs);
  } else if (logs[1] === 'warn') {
    logs.splice(1,1)
    console.warn.apply(console, logs);
  } else if (logs[1] === 'log') {
    logs.splice(1,1)
    console.log.apply(console, logs);
  } else {
    console.log.apply(console, logs);
  }
}

BackendAssistant.prototype.errorManager = function(e, options) {
  const self = this;
  options = options || {};
  options.log = typeof options.log === 'undefined' ? true : options.log;
  options.sentry = typeof options.sentry === 'undefined' ? true : options.sentry;
  options.send = typeof options.send === 'undefined' ? true : options.send;
  options.code = typeof options.code === 'undefined' ? 501 : options.code;
  const newError = e instanceof Error ? e : new Error(e);

  // Log the error
  if (options.log) {
    self.error(newError);
  }

  // Send error to Sentry
  if (options.sentry) {
    self.ref.Manager.libraries.sentry.captureException(newError);
  }

  // Quit and respond to the request
  if (options.send) {
    return self.ref.res.status(options.code).send(newError ? newError.message || newError : 'Unknown error');
  }
}


BackendAssistant.prototype.authenticate = async function (options) {
  const self = this;
  let admin = self.ref.admin;
  let functions = self.ref.functions;
  let req = self.ref.req;
  let res = self.ref.res;
  let data = self.request.data;
  let idToken;
  options = options || {};

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    self.log('Found "Authorization" header');
    // Read the ID Token from the Authorization header.
    idToken = req.headers.authorization.split('Bearer ')[1];
  } else if (req.cookies && req.cookies.__session) {
    self.log('Found "__session" cookie');
    // Read the ID Token from cookie.
    idToken = req.cookies.__session;
  } else if (data.backendManagerKey || data.authenticationToken) {
    self.log('Found "backendManagerKey" or "authenticationToken" parameter');
    // Check with custom BEM Token
    let storedApiKey;
    try {
      storedApiKey = _.get(functions.config(), 'backend_manager.key', '')
    } catch (e) {

    }

    if (storedApiKey && (storedApiKey === data.backendManagerKey || storedApiKey === data.authenticationToken)) {
      self.request.user.authenticated = true;
      self.request.user.roles.admin = true;
      return self.request.user;
    }
    idToken = data.backendManagerKey || data.authenticationToken;
  } else if (options.apiKey) {
    if (options.apiKey.includes('test')) {
      return self.request.user;
    }
    await admin.firestore().collection(`users`)
    .where("api.privateKey", "==", options.apiKey)
    .get()
    .then(function(querySnapshot) {
      querySnapshot.forEach(function(doc) {
        self.request.user = doc.data();
        self.request.user.authenticated = true;
      });
    })
    .catch(function(error) {
      console.log("Error getting documents: ", error);
    });
    return self.request.user;
  } else {
    self.log('No Firebase ID token was passed as a Bearer token in the Authorization header.',
      'Make sure you authenticate your request by providing the following HTTP header:',
      'Authorization: Bearer <Firebase ID Token>',
      'or by passing a "__session" cookie.',
      'or by passing backendManagerKey or authenticationToken in the body or query');
    return self.request.user;
  }

  // Check with firebase
  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    if (options.debug) {
      self.log('Token correctly decoded', decodedIdToken.email, decodedIdToken.user_id);
    }
    await admin.firestore().doc(`users/${decodedIdToken.user_id}`)
    .get()
    .then(async function (doc) {
      if (doc.exists) {
        self.request.user = Object.assign({}, self.request.user, doc.data());
      }
      self.request.user.authenticated = true;
      self.request.user.auth.uid = decodedIdToken.user_id;
      self.request.user.auth.email = decodedIdToken.email;
      if (options.debug) {
        self.log('Found user doc', self.request.user)
      }
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
      return value !== 'http:' &&
             value !== 'https:' &&
             value !== '' &&
             value !== 'github.com';
  });
  return {
    user: repoSplit[0],
    name: repoSplit[1],
  }
};

BackendAssistant.prototype.getHeaderUserAgent = function (headers) {
  headers = headers || {};
  return (
    headers['user-agent']
    || ''
  )
  .trim();
}

BackendAssistant.prototype.getHeaderCountry = function (headers) {
  headers = headers || {};
  return (
    // these are present for cloudflare requests (11/21/2020)
    headers['cf-ipcountry']

    // these are present for non-cloudflare requests (11/21/2020)
    || headers['x-appengine-country']

    // Not sure about these
    // || headers['x-country-code']
    || 'ZZ'
  )
  .split(',')[0]
  .trim();
}

BackendAssistant.prototype.getHeaderIp = function (headers) {
  headers = headers || {};
  return (
    // these are present for cloudflare requests (11/21/2020)
    headers['cf-connecting-ip']
    || headers['fastly-temp-xff']

    // these are present for non-cloudflare requests (11/21/2020)
    || headers['x-appengine-user-ip']
    || headers['x-forwarded-for']

    // Not sure about these
    // || headers['fastly-client-ip']
    || '127.0.0.1'
  )
  .split(',')[0]
  .trim();
}

// https://cloud.google.com/functions/docs/writing/http#multipart_data
BackendAssistant.prototype.parseMultipartFormData = function (options) {
  const self = this;
  return new Promise(function(resolve, reject) {
    if (!self.initialized) {
      return reject(new Error('Cannot run .parseMultipartForm() until .init() has been called'));
    }
    const existingData = self.request.multipartData;
    // console.log('-----existingData', existingData, Object.keys(_.get(existingData, 'fields', {})).length, Object.keys(_.get(existingData, 'files', {})).length);
    if (Object.keys(_.get(existingData, 'fields', {})).length + Object.keys(_.get(existingData, 'files', {})).length > 0) {
      return resolve(existingData);
    }

    options = options || {};

    const path = require('path');
    const os = require('os');
    const fs = require('fs');
    const req = self.ref.req;
    const res = self.ref.res;

    // Node.js doesn't have a built-in multipart/form-data parsing library.
    // Instead, we can use the 'busboy' library from NPM to parse these requests.
    const Busboy = require('busboy');


    // if (req.method !== 'POST') {
    //   // Return a "method not allowed" error
    //   return res.status(405).end();
    // }
    options.headers = options.headers || req.headers;
    options.limits = options.limits || {};

    // console.log('++++++++options.headers', options.headers);
    // console.log('++++++++req.rawBody', req.rawBody);
    // console.log('++++++++options.limits', options.limits);
    // console.log('----req.rawBody', req.rawBody);

    const busboy = new Busboy({
      headers: options.headers,
      limits: options.limits,
    });
    const tmpdir = os.tmpdir();

    // This object will accumulate all the fields, keyed by their name
    const fields = {};

    // This object will accumulate all the uploaded files, keyed by their name.
    const uploads = {};

    // This code will process each non-file field in the form.
    busboy.on('field', (fieldname, val) => {
      /**
       *  TODO(developer): Process submitted field values here
       */
      // console.log(`Processed field ${fieldname}: ${val}.`);
      fields[fieldname] = val;
    });

    const fileWrites = [];

    // This code will process each file uploaded.
    busboy.on('file', (fieldname, file, filename) => {
      // Note: os.tmpdir() points to an in-memory file system on GCF
      // Thus, any files in it must fit in the instance's memory.
      // console.log(`Processed file ${filename}`);
      const filepath = path.join(tmpdir, filename);
      uploads[fieldname] = filepath;

      const writeStream = fs.createWriteStream(filepath);
      file.pipe(writeStream);

      // File was processed by Busboy; wait for it to be written.
      // Note: GCF may not persist saved files across invocations.
      // Persistent files must be kept in other locations
      // (such as Cloud Storage buckets).
      const promise = new Promise((resolve, reject) => {
        file.on('end', () => {
          writeStream.end();
        });
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
      fileWrites.push(promise);
    });

    // Triggered once all uploaded files are processed by Busboy.
    // We still need to wait for the disk writes (saves) to complete.
    busboy.on('finish', async () => {
      await Promise.all(fileWrites);

      /**
       * TODO(developer): Process saved files here
       */
      // for (const file in uploads) {
      //   fs.unlinkSync(uploads[file]);
      // }
      // res.send();
      self.request.multipartData = {
        fields: fields,
        files: uploads,
      }

      return resolve(self.request.multipartData)
    });

    // busboy.end(req.rawBody);
    return req.pipe(busboy);
  });
}


/**
 * Parses a 'multipart/form-data' upload request
 *
 * @param {Object} req Cloud Function request context.
 * @param {Object} res Cloud Function response context.
 */





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

module.exports = BackendAssistant;
