const path = require('path')
const chalk = require('chalk')
const child_process = require('child_process')
const fs = require('fs')
const inquirer = require('inquirer')
const Config = require('../utils/config')
const utils = require('../utils')
const Path = require('path')
const Fs = require('fs');
//const startJSServer = require('./server')

/**
 * Build and run Android app on a connected emulator or device
 * @param {Object} options
 */
function buildAndroid(options) {
  //startJSServer()
  prepareAndroid({options})
    .then(resolveConfig)
    .then(buildApp)
    .catch((err) => {
      if (err) {
        console.log(err)
      }
    })
}

/**
 * Prepare
 * @param {Object} options
 */
function prepareAndroid({options}) {
  return new Promise((resolve, reject) => {
    const rootPath = process.cwd()

    if (!utils.checkAndroid(rootPath)) {
      console.log()
      console.log(chalk.red('  Android project not found !'))
      console.log()
      console.log(`  You should run ${chalk.blue('weexpack init')} first`)
      reject()
    }

    console.log()
    console.log(` => ${chalk.blue.bold('Will start Android app')}`)

    // change working directory to android
    process.chdir(path.join(rootPath, 'android/playground'))

    if (!process.env.ANDROID_HOME) {
      console.log()
      console.log(chalk.red('  Environment variable $ANDROID_HOME not found !'))
      console.log()
      console.log(`  You should set $ANDROID_HOME first.`)
      console.log(`  See ${chalk.cyan('http://stackoverflow.com/questions/19986214/setting-android-home-enviromental-variable-on-mac-os-x')}`)
      reject()
    }

    try {
      child_process.execSync(`adb kill-server`, {encoding: 'utf8'})
    } catch(e) {
      reject()
    }
    try {
      child_process.execSync(`adb start-server`, {encoding: 'utf8'})
    } catch(e) {
      reject()
    }

    resolve({options})
  })
}

function resolveConfig(){
  let androidConfig = new Config('ApplicationId,AppName,SplashText');
  return androidConfig.getConfig().then((config) => {
    console.log(config,process.cwd());
    let bundleConfigPath=Path.join(process.cwd(),'app/bundle.gradle');
    let bundleConfig=Fs.readFileSync(bundleConfigPath).toString();
    bundleConfig=bundleConfig.replace(/applicationId "[^"]*"/g,'applicationId "'+config.ApplicationId+'""')
    Fs.writeFileSync(bundleConfigPath,bundleConfig);
    let stringConfigPath=Path.join(process.cwd(),'app/src/main/res/values/string.xml');
    let stringConfig=Fs.readFileSync(stringConfigPath).toString();
    stringConfig=stringConfig.replace(/<string name="app_name">[^<>]+<\/string>/g,'<string name="app_name">'+config.AppName+'</string>')
    stringConfig=stringConfig.replace(/<string name="dummy_content">[^<>]+<\/string>/g,'<string name="dummy_content">'+config.SplashText.replace(/\n/g,'\\n')+'</string>')
    Fs.writeFileSync(stringConfigPath,stringConfig);

    return {};
  })
}


/**
 * find android devices
 * @param {Object} options
 */
function findAndroidDevice({options}) {
  return new Promise((resolve, reject) => {
    let devicesInfo = ''
    try {
      devicesInfo = child_process.execSync(`adb devices`, {encoding: 'utf8'})
    } catch(e) {
      console.log(chalk.red(`adb devices failed, please make sure you have adb in your PATH.`))
      console.log(`See ${chalk.cyan('http://stackoverflow.com/questions/27301960/errorunable-to-locate-adb-within-sdk-in-android-studio')}`)
      reject()
    }

    let devicesList = utils.parseDevicesResult(devicesInfo)

    resolve({devicesList, options})
  })
}

/**
 * Choose one device to run
 * @param {Array} devicesList: name, version, id, isSimulator
 * @param {Object} options
 */
function chooseDevice({devicesList, options}) {
  return new Promise((resolve, reject) => {
    if (devicesList) {
      const listNames = [new inquirer.Separator(' = devices = ')]
      for (const device of devicesList) {
        listNames.push(
          {
            name: `${device}`,
            value: device
          }
        )
      }

      inquirer.prompt([
          {
            type: 'list',
            message: 'Choose one of the following devices',
            name: 'chooseDevice',
            choices: listNames
          }
        ])
        .then((answers) => {
          const device = answers.chooseDevice
          resolve({device, options})
        })
    } else {
      reject('No android devices found.')
    }
  })
}

/**
 * Adb reverse device, allow device connect host network
 * @param {String} device
 * @param {Object} options
 */
function reverseDevice({device, options}) {
  return new Promise((resolve, reject) => {
    try {
      child_process.execSync(`adb -s ${device} reverse tcp:8080 tcp:8080`, {encoding: 'utf8'})
    } catch(e) {
      reject()
    }

    resolve({device, options})
  })
}

/**
 * Build the Android app
 * @param {String} device
 * @param {Object} options
 */
function buildApp({device, options}) {
  return new Promise((resolve, reject) => {
    console.log(` => ${chalk.blue.bold('Building app ...')}`)
    try {
      child_process.execSync(`./gradlew clean assemble`, {encoding: 'utf8', stdio: [0,1,2]})
    } catch(e) {
      reject()
    }

    resolve({device, options})
  })
}

/**
 * Install the Android app
 * @param {String} device
 * @param {Object} options
 */
function installApp({device, options}) {
  return new Promise((resolve, reject) => {
    console.log(` => ${chalk.blue.bold('Install app ...')}`)

    const apkName = 'app/build/outputs/apk/playground.apk'
    try {
      child_process.execSync(`adb -s ${device} install -r  ${apkName}`, {encoding: 'utf8'})
    } catch(e) {
      reject()
    }

    resolve({device, options})
  })
}

/**
 * Run the Android app on emulator or device
 * @param {String} device
 * @param {Object} options
 */
function runApp({device, options}) {
  return new Promise((resolve, reject) => {
    console.log(` => ${chalk.blue.bold('Running app ...')}`)

    const packageName = fs.readFileSync(
      'app/src/main/AndroidManifest.xml',
      'utf8'
    ).match(/package="(.+?)"/)[1]


    try {
      child_process.execSync(`adb -s ${device} shell am start -n ${packageName}/.SplashActivity`, {encoding: 'utf8'})
    } catch(e) {
      reject(e)
    }

    resolve()
  })
}

module.exports = buildAndroid
