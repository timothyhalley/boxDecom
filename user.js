// Initialize SDK
const boxSDK = require('box-node-sdk'); // Box SDK
const fs = require('fs'); // File system for config
const wsLogFile = fs.createWriteStream('./data/USER_logFile.txt', {encoding: 'UTF-8'});
const util = require('util');

// Node stuff
const nodeCleanup = require('node-cleanup');
const {Signale} = require('signale');
const ioptions = {
  scope: 'BoxApp',
  stream: [process.stdout, wsLogFile],
  interactive: true,
  types: {
    running: {
      badge: '🏃🏿‍',
      color: 'red',
      label: 'RUNNING'
    },
    error: {
      badge: '😢',
      label: 'ERROR'
    },
    success: {
      badge: '😁',
      label: 'SUCCESS'
    },
    folder: {
      badge: '🗂',
      color: 'blue',
      label: 'FOLDERS'
    },
    user: {
      badge: '🤦🏿‍',
      color: 'blue',
      label: 'USER'
    }
  }
};
const soptions = {
  scope: 'BoxApp',
  stream: [process.stdout, wsLogFile],
  interactive: false,
  types: {
    running: {
      badge: '🏃🏿‍',
      color: 'red',
      label: 'RUNNING'
    },
    error: {
      badge: '😢',
      label: 'ERROR'
    },
    success: {
      badge: '😁',
      label: 'SUCCESS'
    },
    folder: {
      badge: '🗂',
      color: 'blue',
      label: 'FOLDERS'
    },
    user: {
      badge: '🤦🏿‍',
      color: 'blue',
      label: 'USER'
    }
  }
};
const interactive = new Signale(ioptions);
const staticlog = new Signale(soptions);

// Fetch config file for instantiating SDK instance
const configJSON = JSON.parse(fs.readFileSync('./ConcurOne.json'));
const SDK = boxSDK.getPreconfiguredInstance(configJSON);

// Get the service account client, used to create and manage app user accounts
var serviceAccountClient = SDK.getAppAuthClient('enterprise', configJSON.enterpriseID);

// get input file from command line
if (process.argv[2] == undefined) {

  interactive.warn('\n\n\tUSAGE: node user.js [path]/filename.csv\n\t\t (eg. node user.js ./data/inputList_UserData.txt)\n\n');

} else {

  var inputFileName = process.argv[2];
  staticlog.note('\n INFO: processing: ', inputFileName, '\n\n')

  var totalUsers = 0;
  var totalErrors = 0;

  if (checkValidFile(inputFileName)) {

    staticlog.await('... reading input file ...')
    var userEmails = fs.readFileSync(inputFileName).toString().split("\n");
    staticlog.success('... input file read with [%d] ...', userEmails.length)

    start(userEmails);

  }
}

// = =========================================

async function start(userEmails) {
  var cnt = 0;
  for (let user of userEmails) {
    if (user.indexOf('@') > 0) {
      let status = await setStatus(user);
      staticlog.user('[%d] Status set for: %s = %s ', ++cnt, user, status)
    }
  }
}

async function getUserFileList(inputFileName) {

  let userList = [];
  let cnt = 0;

  //var fileEmail = fs.readFileSync(inputFileName).split('\n');
  fs.readFileSync(inputFileName).toString().split('\n').forEach(function(line) {
    userList[cnt] = line;
    cnt++;
  });

  console.log('getUserFileList', userList)

  return userList;

}

async function setStatus(userEmail) {

  let boxUID = await getUserID(userEmail);

  if (boxUID != undefined) {

    //var boxClient = await SDK.getAppAuthClient('user', boxUID);
    var userStatus = await setUserStatus(serviceAccountClient, boxUID);

    return userStatus;

  } else {
    staticlog.error('Could not get BoxID for user: [%s]', userEmail);
  };

}

async function getStatus(userEmail) {

  let totalUsers = 0;
  let boxUID = await getUserID(userEmail);

  if (boxUID != undefined) {

    var boxClient = await SDK.getAppAuthClient('user', boxUID);
    var userStatus = await getUserStatus(boxClient, boxUID);

    return userStatus;

  } else {
    staticlog.error('Could not get BoxID for user: [%s]', userEmail);
  };

}

// = ========= Node helper functions =====================
function checkValidFile(inputFileName) {

  var fileOkay = false;

  if (fs.existsSync(inputFileName)) {
    fileOkay = true;
  }

  return fileOkay;
}

function fini() {
  //wsLogFile.end();
  nodeCleanup();
}

// ============ BOX API Calls ======================
function setUserStatus(boxClient, boxUID) {

  //return new Promise(resolve => {
  return new Promise(function(resolve, reject) {

    //interactive.watch('Setting user status to inactive: %d ', boxUID);
    // box status: active, inactive, cannot_delete_edit, or cannot_delete_edit_upload

    boxClient.users.update(boxUID, {status: 'inactive'})
      .then(userInfo => {

        resolve(userInfo.status);

      })
      .catch(function(err) {
        staticlog.error('getUserStatus: --> ', err.message);
        reject(err.message);
      });
  })
}

function getUserStatus(boxClient, boxUID) {

  //return new Promise(resolve => {
  return new Promise(function(resolve, reject) {

    interactive.watch('Getting user status: %d ', boxUID);

    boxClient.users.get(boxUID)

      .then(userInfo => {

        resolve(userInfo.status);

      })
      .catch(function(err) {
        staticlog.error('getUserStatus: --> ', err.message);
        reject(err.message);
      });
  })
}

function getUserID(accName) {

  // get all users in the enterprise :)
  return new Promise(resolve => {
    serviceAccountClient._useIterators = true; //{ limit: 1000 }
    serviceAccountClient.enterprise.getUsers({
        filter_term: accName
      })
      .then((usersIterator) => {
        return autoPage(usersIterator);
      })
      .then((users) => {
        //interactive.watch('Length: ', users.length);
        for (i = 0; i < users.length; i++) {

          //interactive.watch('userID: ', users[i].id, '  ', users[i].name);

          // Get an app user client
          var BOX_USER_ID = users[i].id;
          //var appUserClient = SDK.getAppAuthClient('user', BOX_USER_ID);

          // Get folders
          // getUserFolders(BOX_USER_ID, appUserClient);

        }
        resolve(BOX_USER_ID);
      })
      .catch(function(err) {
        staticlog.error('getUserID: ', err.message);
      });
  })
}

// =======================
// =======================
function autoPage(iterator) {
  let collection = [];
  let moveToNextItem = () => {
    return iterator.next()
      .then((item) => {
        if (item.value) {
          collection.push(item.value);
        }
        if (item.done !== true) {
          return moveToNextItem();
        } else {
          return collection;
        }
      })
  }
  return moveToNextItem();
}
