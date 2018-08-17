// BOX SDK Console --> https://concur.ent.box.com/developers/console
// BOX NPM SDK --> https://concur.ent.box.com/developers/console/app/255109/configuration
               --> https://github.com/box/box-node-sdk

// // Initialize SDK
// var BoxSDK = require('box-node-sdk');
// //
// var sdk = new BoxSDK({
//   clientID: '66hkxplq3gwvkrykwg4pdmoa13081mox',
//   clientSecret: 'lPNfOwehBS6dZf8soHoXWx6ApAKbGwvi'
// });

// var BoxSDK = require('box-node-sdk');
// var jsonConfig = require('./auth.json');
// var sdk = BoxSDK.getPreconfiguredInstance(jsonConfig);

// Get the service account client, used to create and manage app user accounts
//var adminClient = sdk.getAppAuthClient('enterprise'); //, '150172');

// serviceAccountClient.folders.getCollaborations('xxxxxx', null, function(err, data) {
//   console.log(data);
//   data.entries.forEach(function(element) {
//     console.log(element)
//   }, this);
// })

const boxSDK = require('box-node-sdk');  // Box SDK
const fs = require('fs');                // File system for config

// Fetch config file for instantiating SDK instance
const configJSON = JSON.parse(fs.readFileSync('./ConcurOne.json'));
//console.log('Auth object: ', configJSON.boxAppSettings);
// Instantiate instance of SDK using generated JSON config
const sdk = boxSDK.getPreconfiguredInstance(configJSON);
//console.log('sdk', sdk);
//const adminClient = sdk.getAppAuthClient('enterprise', configJSON.enterpriseId);

// Create a basic API client
var adminClient = sdk.getBasicClient('kCUutX2t8kxMbwWgkcE6ZAafLPT1r1Rn');

// The SDK also supports Promises
adminClient.users.get(adminClient.CURRENT_USER_ID)
    .then(user => console.log('Hello', user.name, '!'))
    .catch(err => console.log('Got an error!', err));

adminClient._useIterators = true;  //{ limit: 1000 }
adminClient.enterprise.getUsers({
    filter_term: 'timothy'
    //filter_term: adminClient.CURRENT_USER_ID
  })
  .then((usersIterator) => {
    return autoPage(usersIterator);
  })
  .then((collection) => {
    console.log('collection length: ', collection.length);
    console.log('collection obj: ', collection, '\n\n');
    for (i = 0; i < collection.length; i++) {
      console.log('userID: ', collection[i].id);
    }
  });

adminClient.folders.get('0')
  .then(folder => {
    //console.log('Folders: ', Object.keys(folder));
    //console.log('Folders: ', folder.item_collection.entries.length );
    console.log('\nFolders: ', folder.item_collection.entries.length, '\n')
    for (i = 0; i < folder.item_collection.entries.length; i++) {
      console.log(folder.item_collection.entries[i].id);

      var folderID = folder.item_collection.entries[i].id;
      adminClient.folders.getCollaborations(folderID)
        .then(collaborations => {
          //console.log('\n Collabe here: \n', Object.keys(collaborations));
          for (i = 0; i < collaborations.buffer.length; i++) {
            console.log('\t', collaborations.buffer[i].id)
          }
        });
    }
  })

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
