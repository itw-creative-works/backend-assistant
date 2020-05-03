<div align="center">
  <a href="https://cdn.itwcreativeworks.com/assets/itw-creative-works/images/logo/itw-creative-works-brandmark-black-x.svg">
    <img src="https://cdn.itwcreativeworks.com/assets/itw-creative-works/images/logo/itw-creative-works-brandmark-black-x.svg">
  </a>
  <br>
  <br>

![GitHub package.json version](https://img.shields.io/github/package-json/v/itw-creative-works/backend-assistant.svg)

![David](https://img.shields.io/david/itw-creative-works/backend-assistant.svg)
![David](https://img.shields.io/david/dev/itw-creative-works/backend-assistant.svg) <!-- ![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/itw-creative-works/backend-assistant.svg) -->
![npm bundle size](https://img.shields.io/bundlephobia/min/backend-assistant.svg)
![Code Climate maintainability](https://img.shields.io/codeclimate/maintainability-percentage/itw-creative-works/backend-assistant.svg)
![npm](https://img.shields.io/npm/dm/backend-assistant.svg) <!-- [![NPM total downloads](https://img.shields.io/npm/dt/backend-assistant.svg?style=flat)](https://npmjs.org/package/backend-assistant) -->
![node](https://img.shields.io/node/v/backend-assistant.svg)
![Website](https://img.shields.io/website/https/itwcreativeworks.com.svg)
![GitHub](https://img.shields.io/github/license/itw-creative-works/backend-assistant.svg)
![GitHub contributors](https://img.shields.io/github/contributors/itw-creative-works/backend-assistant.svg)
![GitHub last commit](https://img.shields.io/github/last-commit/itw-creative-works/backend-assistant.svg)

# Backend Assistant
**Backend Assistant** is an NPM module for Firebase developers that instantly powerful assistive functions for Firebase backends.

[Site](https://itwcreativeworks.com) | [NPM Module](https://www.npmjs.com/package/backend-assistant) | [GitHub Repo](https://github.com/itw-creative-works/backend-assistant)

</div>

## Install
Install with npm:
```shell
npm install backend-assistant
```

## Features
* Automatically parse incoming requests to get relevant information like IP, country, etc
* Automatically console log relevant information like the function name and more.

## Example Setup
After installing via npm, simply paste this script in your `functions/index.js` file.
```js
// In your functions/index.js file
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const Assistant = require('backend-assistant');
let assistant = new Assistant().init({
    admin: admin,
    functions: functions,
    // req: req, // optional
    // res: res, // optional
  },
  {
    accept: 'json',
  })
```
## Usage
Now you can harness powerful features
```js
// assistant.log: correctly logs objects in Firebase functions
assistant.log({
  parent: {
    child: 'value'
  }
}, {environment: 'production'})
```

## Final Words
If you are still having difficulty, we would love for you to post a question to [the Backend Assistant issues page](https://github.com/itw-creative-works/backend-assistant/issues). It is much easier to answer questions that include your code and relevant files! So if you can provide them, we'd be extremely grateful (and more likely to help you find the answer!)

## Projects Using this Library
[Somiibo](https://somiibo.com/): A Social Media Bot with an open-source module library. <br>
[JekyllUp](https://jekyllup.com/): A website devoted to sharing the best Jekyll themes. <br>
[Slapform](https://slapform.com/): A backend processor for your HTML forms on static sites. <br>
[SoundGrail Music App](https://app.soundgrail.com/): A resource for producers, musicians, and DJs. <br>
[Hammock Report](https://hammockreport.com/): An API for exploring and listing backyard products. <br>

Ask us to have your project listed! :)
