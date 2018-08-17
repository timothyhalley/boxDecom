// Initialize SDK
const boxSDK = require('box-node-sdk'); // Box SDK
const fs = require('fs'); // File system for config
const wsLogFile = fs.createWriteStream('./data/TEST_logFile.txt', {encoding: 'UTF-8'});

// Node stuff
const prettyMs = require('pretty-ms');
var nodeCleanup = require('node-cleanup');
const {Signale} = require('signale');
const ioptions = {
  scope: 'BoxApp',
  //stream: [process.stdout, wsLogFile],
  interactive: true,
  types: {
    running: {
      badge: '🏃🏿‍',
      color: 'red',
      label: 'Running'
    },
    error: {
      badge: '😢',
      label: 'ERROR'
    },
    success: {
      badge: '😁',
      label: 'Success'
    },
    folder: {
      badge: '🗂',
      color: 'yellow',
      label: 'Folders'
    },
    user: {
      badge: '🤦🏿‍',
      color: 'blue',
      label: 'User'
    },
    fini: {
      badge: '🏁',
      color: 'cyan',
      label: 'Finished'
    },
    bomb: {
      badge: '💣',
      color: 'magentaBright',
      label: 'Update'
    }
  }
};
const soptions = {
  scope: 'BoxApp',
  //stream: [process.stdout, wsLogFile],
  interactive: false,
  types: {
    running: {
      badge: '🏃🏿‍',
      color: 'red',
      label: 'Running'
    },
    error: {
      badge: '😢',
      label: 'ERROR'
    },
    success: {
      badge: '😁',
      label: 'Success'
    },
    folder: {
      badge: '🗂',
      color: 'yellow',
      label: 'Folders'
    },
    user: {
      badge: '🤦🏿‍',
      color: 'blue',
      label: 'User'
    },
    fini: {
      badge: '🏁',
      color: 'cyan',
      label: 'Finished'
    },
    bomb: {
      badge: '💣',
      color: 'magentaBright',
      label: 'Update'
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

  interactive.warn('\n\n\tUSAGE: node c2viewer.js [path]/inputList.txt\n\t\t (eg. node c2viewer.js ./bel85_users.txt)\n\n');

} else {

  var inputFileName = process.argv[2];
  staticlog.note('processing: ', inputFileName)

  var totalUsers = 0;
  var totalErrors = 0;

  if (checkValidFile(inputFileName)) {

    staticlog.await('... reading input file ...')
    //var inputFileList = fs.readFileSync(inputFileName).toString().split("\n");
    let inputFileList = [];
    fs.readFileSync(inputFileName).toString().split("\n").forEach(function(line, index, arr) {
      if (index === arr.length - 1 && line === "") {
        return;
      }
      inputFileList.push(line);
    });
    staticlog.success('Input file read: [%d] BOX users\n', inputFileList.length)
    //staticlog.debug('inputFile: ', inputFileList)
    start(inputFileList);
  }
}

// = =========================================
async function start(userEmails) {

  var userCnt = 0;
  for (let userEmail of userEmails) {

    if (userEmail.indexOf('@') > 0) {

      staticlog.start('USER: [%d] %s', ++userCnt, userEmail);
      let boxUID = await getUserID(userEmail);

      if (boxUID != undefined) {

        interactive.await('Processing User: %s', userEmail);
        let boxClient = await SDK.getAppAuthClient('user', boxUID);
        let dtime = await processUser(boxClient, boxUID, userEmail);
        interactive.fini('%s completed in \t%s\n', userEmail, prettyMs(dtime, {verbose: true}))

      } else {
        staticlog.error('Could not get BoxID for user: [%s]', userEmail);
      }

    } else {
      userEmail = 'invalid email';
      staticlog.error('Incorrect BOX User format on line: [%d]', userCnt);
    }
  }

  fini(); // node clean up
  staticlog.success('\nFinished... all %d users completed!', userCnt);

}

async function processUser(boxClient, boxUID, userEmail) {

  let folderCnt = 0;
  interactive.time();
  interactive.await('Getting user folders...');
  let masterFolderList = await getAllOwnedFolders(boxClient, boxUID);

  for (let folderID of masterFolderList) {
    let status = await updateCollaborations(boxClient, folderID);
    folderCnt++;
    interactive.star('Collaborations for folder: [%d] - [%s] for %d of %d', folderID, status, folderCnt, masterFolderList.length);
  }

  let timeVal = interactive.timeEnd()
  // console.log('timeVal:', timeVal)
  // console.log(Object.keys(timeVal))
  return timeVal.span;

}

function updateCollaborations(boxClient, folderID) {

  return new Promise(function(resolve, reject) {

    boxClient.folders.getCollaborations(folderID)
      .then(collaborations => {

        for (let collabItem of collaborations.entries) {
          if (collabItem.role != 'viewer') {

            var collaborationID = collabItem.id;
            var updates = {
              role: boxClient.collaborationRoles.VIEWER
            };
            boxClient.collaborations.update(collaborationID, updates)
              .then(updatedCollaboration => {
                staticlog.bomb('Found and updated collaboration for: ', updatedCollaboration.accessible_by.name, 'set to: ', updatedCollaboration.role);
              });
          }

        }
        resolve('success');
      })
      .catch(function(err) {
        console.error('\n\nERROR: ', folderID, ' :: ', err.message, '\n\n');
        reject(err);
      });

  });
}

async function getAllOwnedFolders(boxClient, boxUID) {

  let runList = [0]; // zero = root folder for box.com
  //let ownedList = [];
  let addList = [];
  let fullList = [];
  let moreFolders = false;

  do {

    moreFolders = false;

    for (let folderID of runList) {

      let ownedList = await getOwnedFolders(boxClient, boxUID, folderID);

      if (ownedList != undefined && ownedList.length > 0) {
        for (let folderID of ownedList) {
          fullList.push(folderID);
          addList.push(folderID);
        }
      } else {
        interactive.folder('No folders found in folderID: %d', folderID)
      }
    }

    if (addList.length > 0){
      runList = addList;
      addList = [];
      moreFolders = true;
    }

    //staticlog.debug('User Folder Count = [%d]', fullList.length);

  } while (moreFolders);

  return fullList;
}

async function getOwnedFolders(boxClient, boxUID, folderID) {

  try {
    let ownedFolderList = [];
    let folderList = await getAllFolders(boxClient, boxUID, folderID);

    for (let folderID of folderList) {
      let ifOwnedBy = await checkIfOwnedBy(boxClient, boxUID, folderID);
      if (ifOwnedBy) {
        ownedFolderList.push(folderID);
      }
    }
    return ownedFolderList
  } catch (e) {
    staticlog.error('getOwnedFolders --> ', e.message);
  }

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

// async function getFolders(boxClient, boxUID, folderID) {
//
//   try {
//     let userMasterFolderList = [];
//     let boxFolderList = await getAllFolders(boxClient, boxUID, folderID)
//
//     for (let folderID of boxFolderList) {
//       interactive.folder('🏃🏻‍ ... processing folderID: [%d]', folderID)
//       let ownedBy = await checkIfOwnedBy(boxClient, boxUID, boxFolderList[x]);
//       if (ownedBy) {
//         userMasterFolderList.push(folderID)
//       }
//     }
//     totalFolders = totalFolders + boxFolderList.length;
//
//     return boxFolderList;
//
//   } catch (e) {
//     staticlog.error('getFolders --> ', e.message);
//   }
//
// }

function checkIfOwnedBy(boxClient, boxUID, folderID) {

  return new Promise(function(resolve, reject) {

    boxClient.folders.get(folderID, {type: 'folder'}) //, {type: 'folder'}
      .then(userFolder => {
        var folderOwnerID = userFolder.owned_by.id;
        var trueOwner = false;
        if (boxUID == folderOwnerID) {

          interactive.folder('Folder [%d] %s [size: %d]', userFolder.id, userFolder.name, userFolder.item_collection.total_count);
          trueOwner = true;

        }
        resolve(trueOwner)
      })
      .catch(err => {
        staticlog.error('checkIfOwnedBy: --> ', err.message);
        reject(err.message);
      });

  })
}

function getAllFolders(boxClient, boxUID, folderID) {

  //return new Promise(resolve => {
  return new Promise(function(resolve, reject) {

    //interactive.watch('getting folders in ', folderID);
    boxClient.folders.getItems(folderID) //, {type: 'folder', limit: 1000})

      .then(boxFolderData => {
        let folderList = [];
        //for (i = 0; i < boxFolderData.entries.length; i++) {
        for (let folderItems of boxFolderData.entries) {
          //folderList.push(boxFolderData.entries[i].id);
          if (folderItems.type == 'folder') {
            folderList.push(folderItems.id);
          }
        }

        resolve(folderList);

      })
      .catch(function(err) {
        staticlog.error('getAllFolders: --> ', err.message);
        reject(err.message);
      });
  })
}

function getBoxFoldersX(option) {
  return new Promise(resolve => {

  });
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
        staticlog.error('😢  getUserID: 😢 ', err.message);
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

// = --------- Get Input File info -----------
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

// ---------------------------------------------
nodeCleanup(function(exitCode, signal) {
  if (signal) {
    unsavedData.save(function done() {
      // calling process.exit() won't inform parent process of signal
      process.kill(process.pid, signal);
    });
    nodeCleanup.uninstall(); // don't call cleanup handler again
    return false;
  }
});
