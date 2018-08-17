// BOX SDK Console --> https://concur.ent.box.com/developers/console
// BOX NPM SDK --> https://concur.ent.box.com/developers/console/app/255109/configuration
// https: //github.com/box/box-node-sdk
// Aysnc --> https://davidwalsh.name/async-await

// Initialize SDK
const boxSDK = require('box-node-sdk'); // Box SDK
const fs = require('fs'); // File system for config

// Node stuff
var nodeCleanup = require('node-cleanup');

// Fetch config file for instantiating SDK instance
const configJSON = JSON.parse(fs.readFileSync('./ConcurOne.json'));
const SDK = boxSDK.getPreconfiguredInstance(configJSON);

// Get the service account client, used to create and manage app user accounts
var serviceAccountClient = SDK.getAppAuthClient('enterprise', configJSON.enterpriseID);

// get user name from command line
if (process.argv[2] == undefined) {
  console.warn('\n\bUSAGE: node app.js [box user ID]\n\t (eg. node app.js Napoleon.Bonaparte)\n\n');
} else {
  var boxUserName = process.argv[2];
  console.info('\n INFO: processing: ', boxUserName, '\n\n')

  start();
  fini();
}

//---------------   fun stuff below    --------------------
async function start() {

  console.log('calling..\n\n');
  let boxUID = await getUserID(boxUserName);

  console.log('boxID: ', boxUID, ' for ', boxUserName);
  var boxClient = SDK.getAppAuthClient('user', boxUID);

  var totalFolders = 0;
  var totalFoldersOwned = 0;
  var totalCollaborations = 0;
  var masterFolderList = [];
  var userFolders = [0]; // start with ROOT ZERO

  do {

    var moreFolders = false;
    var addToMasterList = [];
    var folderList = [];

    for (z = 0; z < userFolders.length; z++) { /// TODO need to reset this after

      folderList = [];
      try {
        let holdList = await getFolderList(boxClient, boxUID, userFolders[z])
        for (i = 0; i < holdList.length; i++) {
          folderList.push(holdList[i]);
        }
        //console.debug('DEBUG: HoldList for folder: ', userFolders[z], '\n', holdList);
        totalFolders = totalFolders + holdList.length;

      } catch (e) {
        console.error('\nERROR: getFolderList 🕶️ --> \n', e.message);
      }

      // find folder owner and save short list
      for (i = 0; i < folderList.length; i++) {
        try {

          let ifOwnedBy = await checkIfOwnedBy(boxClient, boxUID, folderList[i]);
          if (ifOwnedBy) {
            //console.debug('DEBUG: adding new folder to temp list --> ', folderList[i])
            addToMasterList.push(folderList[i]);
            moreFolders = true;
            totalFoldersOwned = totalFoldersOwned++;
          }
          //console.debug('DEBUG: addToMasterList for folder: ', folderList[i], '\n', addToMasterList);
        } catch (e) {
          //console.error('\nERROR: checkIfOwnedBy 🕶️ --> \n', e.message);
        }
      }
      //console.log('... which only owns: ', addToMasterList.length, ' of ', folderList.length);
      userFolders = addToMasterList;
    }

    // console.log('New folder to add to master list: \n', addToMasterList, '\n')
    for (y = 0; y < userFolders.length; y++) {
      masterFolderList.push(userFolders[y]);
    }
    //console.debug('DEBUG: masterFolderList:\n', masterFolderList);
    addToMasterList = []; // reset new folder list
    //console.log('new User Folders List: ', userFolders)
    // console.log('masterFolderList: \n', masterFolderList, '\n')


  } while (moreFolders);


  // console.log('Update collaboration of owned folders:', masterFolderList.length);
  for (z = 0; z < masterFolderList.length; z++) {
    //console.log('Update folder collab: ', masterFolderList[i]);
    try {
      let collabFound = await updateCollaborations(boxClient, masterFolderList[z]);
      //console.debug('DEBUG: collabFound = ', collabFound);
      if (collabFound) {
        totalCollaborations = totalCollaborations++;
      }
    } catch (e) {
      console.error('ERROR: updateCollaborations 🕶️ --> ', e.message);
    }
  }

  // console.log('Set User to CONNOT_DELETE_EDIT_UPLOAD');
  // let userStatus = await setUserToRO(boxClient, boxUID);
  // console.log(userStatus);
  console.log('Stats for BoxUser: \n\t', boxUserName, '[', boxUID, ']');
  console.log('\t Totals folders: ', totalFolders, '\t owning: [', totalFoldersOwned, ']\tMasterList: ', masterFolderList.length);
  //console.log('\t Total Collaborations Changed: ', totalCollaborations);
  console.log('\n hung up..');
}

function fini() {
  nodeCleanup();
}


// =======================

function setUserToRO(boxClient, boxUID) {

  console.log('setting user to RO: ', boxUID);

  return new Promise(resolve => {

    boxClient.users.update(boxUID, { status: 'cannot_delete_edit_upload' })
    	.then(user => {

        resolve(user);

    	});

    })
    .catch(function(err) {
      console.error('\n\nERROR: ', setUserToRO, ' :: ', err.message, '\n\n');
      resolve(false);
    });

}

function nextPromiseTemplate(boxClient, folderID) {

  console.log('updateCollaborations ... on folder: ', folderID);

  return new Promise(resolve => {

  });
}

function updateCollaborations(boxClient, folderID) {

  return new Promise(function(resolve, reject) {

    console.info('\t <-- Collaboration Check:\t', folderID);

    boxClient.folders.getCollaborations(folderID)
      .then(collaborations => {
        //console.log('C:\n', collaborations);
        //console.log('Number of collaborations for folder', folderID, ' to check: ', collaborations.entries.length);
        for (y = 0; y < collaborations.entries.length; y++) {
          // console.log('\t\t\t', 'folder --> ', folderID, ' collaboration ID --> ', collaborations.entries[y].id, ' role --> ', collaborations.entries[y].role);
          if (collaborations.entries[y].role != 'viewer') {

            var collaborationID = collaborations.entries[y].id;
            var updates = {
              role: boxClient.collaborationRoles.VIEWER
            };
            boxClient.collaborations.update(collaborationID, updates)
              .then(updatedCollaboration => {
                console.info('UPDATED COLLAB: \t', updatedCollaboration.accessible_by.name, 'set to: ', updatedCollaboration.role);
              });
          }
        }
        resolve(true);
      })
      .catch(function(err) {
        console.error('\n\nERROR: ', folderID, ' :: ', err.message, '\n\n');
        reject(err);
      });

  });
}

function checkIfOwnedBy(boxClient, boxUID, folderID) {

  //console.log('... if owning folder: ', folderID);

  return new Promise(function(resolve, reject) {

    boxClient.folders.get(folderID, {type: 'folder'}) //, {type: 'folder'}
      .then(userFolder => {
        //console.debug('DEBUG: \t folder Name: ', userFolder.name, ' & ID: ', folderID);
        var folderOwnerID = userFolder.owned_by.id;
        var trueOwner = false;
        if (boxUID == folderOwnerID) {
          //console.info('\t--> ID:\t', userFolder.id, '\t', userFolder.name, ' - [', userFolder.item_collection.total_count, ']');
          trueOwner = true;
        }
        resolve(trueOwner)
      })
      .catch(err => {
        if (err.message.indexOf('Unexpected API Response [404 Not Found') != 0) {
          console.error('\nERROR: checkIfOwnedBy: ', err.message, ' on folder: ', folderID, '\n\n');
        }
        reject(err);
      });

  })
}

function getFolderList(appUserClient, boxUID, folderID) {

  //return new Promise(resolve => {
  return new Promise(function(resolve, reject) {

    //console.log('getting folders in ', folderID);
    appUserClient.folders.getItems(folderID, {type: 'folder', limit: 100})

      .then(folder => {
        let folderList = [];
        //console.log('getFolderList - found:', folder.entries.length, ' in folder: ', folderID)
        //console.log('test getFolderList: \n', folder)
        for (i = 0; i < folder.entries.length; i++) {
          folderList.push(folder.entries[i].id);
        }

        resolve(folderList);

      })
      .catch(function(err) {
        console.error('\n\nERROR: ', getFolderList, ' :: ', err.message, '\n\n');
        reject(err);
      });
  })
}

function getUserID(accName) {

  // get all users in the enterprise :)
  return new Promise(resolve => {
    serviceAccountClient._useIterators = true;  //{ limit: 1000 }
    serviceAccountClient.enterprise.getUsers({ filter_term: accName })
      .then((usersIterator) => {
          return autoPage(usersIterator);
      })
      .then((users) => {
          //console.log('Length: ', users.length);
          for (i = 0; i < users.length; i++) {

            //console.log('userID: ', users[i].id, '  ', users[i].name);

            // Get an app user client
            var BOX_USER_ID = users[i].id;
            //var appUserClient = SDK.getAppAuthClient('user', BOX_USER_ID);

            // Get folders
            // getUserFolders(BOX_USER_ID, appUserClient);

          }
          resolve(BOX_USER_ID);
      })
      .catch(function(err) {
        console.error('\n\nERROR getUserID: ', err.message, '\n\n');
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
