// BOX SDK Console --> https://concur.ent.box.com/developers/console
// BOX NPM SDK --> https://concur.ent.box.com/developers/console/app/255109/configuration
// https: //github.com/box/box-node-sdk
// Test Users: Jon Griffen, Rick Quinn and Devarshi


// Initialize SDK
const APP_ENTERPRISE_ID = 150172;
const boxSDK = require('box-node-sdk'); // Box SDK
const fs = require('fs'); // File system for config

// Fetch config file for instantiating SDK instance
const configJSON = JSON.parse(fs.readFileSync('./ConcurOne.json'));
//console.log('ENTERPRISE_ID: ', configJSON.enterpriseID);
const sdk = boxSDK.getPreconfiguredInstance(configJSON);
// Get the service account client, used to create and manage app user accounts
var serviceAccountClient = sdk.getAppAuthClient('enterprise', configJSON.enterpriseID);

// Quick AUTH --> Create a basic API client
//var serviceAccountClient = sdk.getBasicClient('GzBwiVRZKpmRkTnnc0gf0TI9d4DFBenj');

// get all users in the enterprise :)
serviceAccountClient._useIterators = true;  //{ limit: 1000 }
serviceAccountClient.enterprise.getUsers({ filter_term: 'rick.quinn' })
    .then((usersIterator) => {
        return autoPage(usersIterator);
    })
    .then((users) => {
        console.log(users.length);
        for (i = 0; i < users.length; i++) {

          console.log('userID: ', users[i].id, '  ', users[i].name);

          // Get an app user client
          var BOX_USER_ID = users[i].id;
          var appUserClient = sdk.getAppAuthClient('user', BOX_USER_ID);

          // Get folders
          var folderNo = '0';
          newList = getUserFolders(BOX_USER_ID, appUserClient, folderNo);
          console.log('New List ', newList);

        }
    });

function getUserFolders(boxUserID, boxClient, folderNo) {

  boxClient.folders.get(folderNo)
    .then(folder => {
      //console.log('Folders: ', Object.keys(folder));
      //console.log('--> Object :\n', folder.item_collection);
      for (i = 0; i < folder.item_collection.entries.length; i++) {
        //console.log('\t Root Level Folders: ', folder.item_collection.entries[i].id);
        var USER_FOLDER_ID = folder.item_collection.entries[i].id;
        boxClient.folders.get(USER_FOLDER_ID)
          .then(userFolder => {

            // folders owned by user
            var folderOwnerID = userFolder.owned_by.id;
            if (boxUserID == folderOwnerID) {

              console.log('\t\tINFO: ', userFolder.id, ' TYPE: ', userFolder.type, ' owned by --> \t', userFolder.owned_by.name);
              var folderID = userFolder.id
              boxClient.folders.getCollaborations(folderID)
                .then(collaborations => {
                  //console.log('collaborations check: \n', collaborations)
                  for (i = 0; i < collaborations.entries.length; i++) {
                    console.log('\t\t\t', 'folder --> ', folderID, ' collaboration ID --> ', collaborations.entries[i].id, ' role --> ', collaborations.entries[i].role);
                    if (collaborations.entries[i].role != 'viewer') {
                    var collaborationID = collaborations.entries[i].id;
                    var updates = {
                    	role: boxClient.collaborationRoles.VIEWER
                    };
                    boxClient.collaborations.update(collaborationID, updates)
                    	.then(updatedCollaboration => {
                    		console.log('UPDATED COLLAB: \n', updatedCollaboration);
                    	});
                    }
                  }
                })
                .catch(function(err) {
                  console.error('\n\nERROR: ', folderID, ' :: ', err.message, '\n\n');
                });
            }

          })
          .catch(err => {
            console.error('\n\nFOLDER ERROR: ', err.message, '\n\n');
          });
      }
    })
    .catch(function(err) {
      console.error('\n\nERROR: ', folder.id, ' :: ', err.message, '\n\n');
    });
}

function getUserFolders_works(boxClient) {

  boxClient.folders.get('0')
    .then(folder => {
      console.log('Folders: ', Object.keys(folder));
      console.log('FolderID:', folder);

      // for (i = 0; i < folder.id.length; i++) {
      //   console.log('\tFolderID = ', folder[i].id, ' folder owner: ', folder[i].owned_by)
      // }

      //console.log('Folders: ', folder.item_collection.entries.length );
      console.log('\nFolders: ', folder.item_collection.entries.length, '\n')
      for (i = 0; i < folder.item_collection.entries.length; i++) {
        console.log('\t', folder.item_collection.entries[i].id);

        var folderID = folder.item_collection.entries[i].id;
        boxClient.folders.getCollaborations(folderID)
          .then(collaborations => {
            //console.log('\n Collabe here: \n', Object.keys(collaborations));
            //console.log('\t\t', collaborations.total_count);
            //console.log('\t\t', collaborations.entries);
            for (i = 0; i < collaborations.entries.length; i++) {
              console.log('\t\t', collaborations.entries[i].id, ' role: --> ', collaborations.entries[i].role)
            }
          })
          .catch(function(err) {
            console.error('\n\nERROR: ', folderID, ' :: ', err.message, '\n\n');
          });
      }
    })
}

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
// serviceAccountClient.asUser(originalOwnerId);
// serviceAccountClient.collaborations.createWithUserID(newOwnerId, folderId, serviceAccountClient.collaborationRoles.CO_OWNER)
//   .then((collaboration) => {
//     console.log(collaboration);
//     return serviceAccountClient.collaborations.update(collaboration.id, {
//       role: serviceAccountClient.collaborationRoles.OWNER
//     });
//   })
//   .then(() => {
//     return serviceAccountClient.folders.getCollaborations(folderId, null);
//   })
//   .then((collaborationsOnFolder) => {
//     let originalOwnerCollaboration;
//
//     let results = collaborationsOnFolder.entries.filter((collaboration) => {
//       return collaboration.accessible_by.id === originalOwnerId;
//     });
//
//     if (results.length > 0) {
//       originalOwnerCollaboration = results[0];
//     } else {
//       throw new Error("Something went wrong when trying to remove the original owner.");
//     }
//
//     return serviceAccountClient.collaborations.delete(originalOwnerCollaboration.id);
//   })
//   .then(() => {
//     console.log("Complete");
//   })
//   .catch((e) => {
//     if (e && e.response) {
//       console.log(`Something went wrong... ${e.response.body}...`);
//     }
//     throw e;
//   });
