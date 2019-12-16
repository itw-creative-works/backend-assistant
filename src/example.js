let assistant = new BackendAssistant();
assistant.init({
  name: 'submissionProcess',
  // environment: 'production',
  refs: {
    req: req,
    res: res,
    admin: admin,
  }
})
assistant.log('This logs in dev only', 'DEV');
assistant.log('This logs in production and dev', {environment: 'production'});
