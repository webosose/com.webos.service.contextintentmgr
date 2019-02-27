// Copyright (c) 2019 LG Electronics, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

const fs = require("fs-extra"),
    allFlowsFileAction = require("./allFlowsFileCreater"),
    _pubsub = require("./pubsub");
const MANIFEST_FILE = "manifest.json";
let userDir = '';
let flowFile = '';
let Red = [];
let previousAppId = ""; //stores enabled flow appId as in manifest
let previousPublishedAppId = ""; //stores Published flow appId as in manifest \\used in dataHandler
let manifest = [];
//subscribe to applicationManager for running state, if running app count is 1 and its not equal to
//previous appId then enable flows, else if previous appId exists disable flows of that app Id
let subscribe = (RED) => {
    let params = {
        "subscribe": true
    };
    userDir = RED.settings.userDir;
    flowFile = RED.settings.flowFile;
    Red = RED;
    let subscribeAppManager = process.service.subscribe('luna://com.webos.applicationManager/running', params);
    subscribeAppManager.on("response", function (response) {
        if (response.payload.running) {
            manifest = [];
            //this check added since running event triggers multiple times
            if (response.payload.running.length == 1) {
                if (previousAppId != response.payload.running[0].id) {
                    enableFlows({
                        "appId": response.payload.running[0].id
                    });
                }
                // used to unsubcribe pub on app closed by other app
                if (previousPublishedAppId != "" && previousPublishedAppId != response.payload.running[0].id) {
                    disablePublisher({
                        "appId": previousPublishedAppId
                    })
                }
            } else if (response.payload.running.length == 0) {
                if (previousAppId != "") {
                    disableFlows({
                        "appId": previousAppId
                    })
                }
                // used to unsubcribe pub on app close
                if (previousPublishedAppId != "") {
                    disablePublisher({
                        "appId": previousPublishedAppId
                    })
                }
            }
        }
    });
}
//used in dynamicDataHandler
let setPublisherAppId = (appId) => {
    console.log("setPublisherAppId");
    previousPublishedAppId = appId;
}
//triggered when need to enable flows of appId
let enableFlows = (data) => {
    console.log("enableFlows : " + previousAppId);
    getManifestValues(data)
        .then(getDisabledFlows)
        .then(commonSteps)
        .then((data) => {
            //store app id for disabling purpose on next call
            previousAppId = data.appId;
            console.log("END: " + previousAppId);
        })
        .catch((e) => {
            console.log(e);
        })
}
//triggered when need to enable flows of previousAppId
let disableFlows = (data) => {
    console.log("disableFlows : " + previousAppId);
    data.disabled = [];
    getManifestValues(data)
        .then(commonSteps)
        .then((data) => {
            //clear it
            previousAppId = "";
            console.log("END: " + previousAppId);
        })
        .catch((e) => {
            previousAppId = "";
            console.log(e);
        })
}
//reads manifest file and stores in global object
let getManifestValues = (data) => {
    console.log("getManifestValues");
    return new Promise((resolve, reject) => {
        let path = userDir + "/" + MANIFEST_FILE;
        try {
            manifest = fs.readJsonSync(path);
            resolve(data);
        } catch (e) {
            reject("Error : manifest file require failed " + path);
        }
    });
}
//triggered app is closed andPublisher is on
let disablePublisher = (data) => {
    console.log("disablePublisher");
    getManifestValues(data)
        .then((data) => {
            if (manifest[data.appId] && manifest[data.appId]["data-publisher-keys"]) {
                manifest[data.appId]["data-publisher-keys"].forEach((key, index, array) => {
                    _pubsub.unsubscribe(key);
                    if (index == array.length - 1) {
                        previousPublishedAppId = "";
                    }
                });
            }
        })
        .catch((e) => {
            previousPublishedAppId = "";
            console.log(e);
        })
}
//get disabled flowId from manifest data using appId
let getDisabledFlows = (data) => {
    console.log("getDisabledFlows");
    return new Promise((resolve, reject) => {
        if (manifest[data.appId] && manifest[data.appId].disabled.length > 0) {
            data.disabled = manifest[data.appId].disabled;
            resolve(data);
        } else {
            //else triggers when u try to launch builtin app / app which not have entry in manifest
            if (previousAppId == "") {
                reject("No disabled flows available for appId : " + data.appId)
            } else {
                data.disabled = [];
                resolve(data);
            }
        }
    });
}
//these steps used in both enable as well as disable flow
let commonSteps = (data) => {
    return new Promise((resolve, reject) => {
        getPreviousEnabled(data)
            .then(getAllFlows)
            .then(enableDisableTabs)
            //called from allFlowFileCreator.js
            .then(allFlowsFileAction.createAllFlowFile)
            .then((data) => {
                //called from allFlowFileCreator.js
                allFlowsFileAction.restartNodes(Red, data)
                    .then((data) => {
                        resolve(data);
                    })
            })
            .catch((e) => {
                reject(e);
            })
    })
}
//get the previous enabled flows to disable it, since app is closed
let getPreviousEnabled = (data) => {
    console.log("getPreviousEnabled");
    return new Promise((resolve, reject) => {
        if (previousAppId == "") {
            data.enabled = [];
            resolve(data);
        } else {
            if (manifest[previousAppId] && manifest[previousAppId].disabled.length > 0) {
                data.enabled = manifest[previousAppId].disabled;
                resolve(data);
            } else {
                data.enabled = [];
                resolve(data);
            }
        }
    });
}
//get .nodered/flows.json as allFlows
let getAllFlows = (data) => {
    console.log("getAllFlows");
    return new Promise((resolve, reject) => {
        data.flowFilePath = userDir + "/" + flowFile;
        try {
            data.allFlows = fs.readJsonSync(data.flowFilePath);
            resolve(data);
        } catch (e) {
            reject("Error : flowFile require failed - " + data.flowFilePath);
        }
    })
}
//loop through and enable present app flows and desable previous app flows
let enableDisableTabs = (data) => {
    console.log("enableDisableTabs");
    return new Promise((resolve, reject) => {
        let itemsProcessed = 0;
        data.allFlows.forEach((node, index, array) => {
            if (node.type == "tab") {
                if (data.disabled.indexOf(node.id) > -1) {
                    data.allFlows[index].disabled = false;
                }
                if (data.enabled.indexOf(node.id) > -1) {
                    data.allFlows[index].disabled = true;
                }
            }
            itemsProcessed++;
            if (itemsProcessed === array.length) {
                resolve(data);
            }
        });
    })
}
//used in flowInstaller.js
module.exports = {
    subscribe: subscribe,
    setPublisherAppId: setPublisherAppId
}