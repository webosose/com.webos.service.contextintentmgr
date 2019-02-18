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
    path = require("path"),
    flowEnabler = require("./flowEnabler"),
    allFlowsFileAction = require("./allFlowsFileCreater"),
    customNodeInstaller = require("./customNodeInstaller"),
    {
        logToPath
    } = require("./logger"),
    APP_DEFAULT_PATH = "/media/developer/apps/usr/palm/applications/",
    FLOW_ID_LIST_FILE = "flowIdList.json",
    MANIFEST_FILE = "manifest.json",
    CIM_FLOW_FILE = "cimFlowFile",
    CIM_CUSTOM_NODES_DIR = "cimCustomNodesDir";
let userDir = '',
    flowFile = '',
    Red = [],
    logPath = '',
    logFolder = '';
//Subscribing to appInstallService, we are referring only installed & removed states
let subscribe = (RED) => {
    console.log("subscribe : AppInstall");
    let params = {
        "subscribe": true
    };
    userDir = RED.settings.userDir;
    flowFile = RED.settings.flowFile;
    Red = RED;
    let subscribeAppInstall = process.service.subscribe('luna://com.webos.appInstallService/status', params);
    flowEnabler.subscribe(RED); //will subscribe for applicationManager to get running app info
    createNewCombinedFlow({}); // one time step to re create flow file on start of the service
    logFolder = path.join(userDir, "logs");
    fs.emptyDir(logFolder); //Clears all old logs in directory
    let appClosing = false; //app clossing event trigger multiple times this is used to trigger remove flow only once.
    subscribeAppInstall.on("response", (response) => {
        if (response.payload.details) {
            let details = response.payload.details;
            logPath = path.join(logFolder, details.packageId + ".log");
            if (details.state == "installed") {
                let appPath = path.join(APP_DEFAULT_PATH, details.packageId),
                    appInfo = {},
                    listApps;
                process.service.call("luna://com.webos.applicationManager/dev/listApps", {
                    "properties": [CIM_FLOW_FILE, CIM_CUSTOM_NODES_DIR]
                }, (response) => {
                    if (response.payload.returnValue) {
                        listApps = response.payload.apps;
                        for (let i = 0, iMax = listApps.length; i < iMax; i++) {
                            if (listApps[i].id === details.packageId && listApps[i][CIM_FLOW_FILE]) {
                                appInfo[CIM_FLOW_FILE] = path.join(appPath, listApps[i][CIM_FLOW_FILE]);
                                appInfo.install = true;
                                appInfo.packageId = details.packageId;
                                if (listApps[i][CIM_CUSTOM_NODES_DIR]) {
                                    appInfo[CIM_CUSTOM_NODES_DIR] = path.join(appPath, listApps[i][CIM_CUSTOM_NODES_DIR]);
                                }
                                break;
                            }
                        }
                        flowInstaller(appInfo);
                    }
                });
            } else if (details.state == "removed") {
                removeFlow(details.packageId);
            } else if (details.state == "app closing") {
                if (appClosing == false) {
                    appClosing = true;
                    removeFlow(details.packageId);
                }
            } else {
                appClosing = false;
            }
        }
    });
}

let writeJSONToDiskSync = (path, JSONData) => {
    let fd;
    try {
        fs.outputJSONSync(path, JSONData);
        fd = fs.openSync(path, 'rs+');
        fs.fdatasyncSync(fd);
        return true;
    } catch (e) {
        console.log("Exception in writing file", e);
        return false;
    }
};

//get called when state is installed, gets appinfo file from app installed path & trigger promise
let flowInstaller = (input, callback) => {
    console.log("flowInstaller :");
    if (input.install == true && input[CIM_FLOW_FILE]) {
        if (!input.packageId) {
            input.packageId = "systemFlow_" + Date.now();
        }
        let flowDetails = {
            "packageId": input.packageId,
            "path": input[CIM_FLOW_FILE],
            "userDir": userDir,
            "installer": true
        };
        let successMsg = "Flow installation successful.";
        if (input[CIM_CUSTOM_NODES_DIR]) {
            flowDetails.customNodeDir = input[CIM_CUSTOM_NODES_DIR];
        }
        doInstallation(flowDetails, (err) => {
            if (callback) {
                let result = {
                    "flowFileId": input.packageId,
                    "message": successMsg
                };
                if (err)
                    result.message = err;
                callback(result);
            } else {
                if (err) {
                    console.log("ERROR LOG ..............", err)
                    logToPath(logPath, true, err);
                } else {
                    successMsg = input.packageId + " : " + successMsg;
                    logToPath(logPath, false, successMsg);
                }
            }
        });
    } else if (input.install == false && input.flowFileId) {
        removeFlow(input.flowFileId)
            .then(() => {
                callback({
                    "flowFileId": input.flowFileId,
                    "message": "Uninstallation Success..."
                });
            })
            .catch((error) => {
                callback({
                    "error": error
                });
            });
    } else {
        callback({
            "error": "Invalid params.."
        });
    }
}
//triggered when state is removed, then initiates promise of remove flow
let removeFlow = (packageId) => {
    console.log("removeFlow : packageId : ", packageId);
    return new Promise((resolve, reject) => {
        let flowDetails = {
            "packageId": packageId,
            "userDir": userDir
        };
        let manifestPath = userDir + "/" + MANIFEST_FILE;
        let file = fs.readJsonSync(manifestPath);
        if (file[packageId]) { //This check added to avoid trigger of our code for app which not part of CIM
            removeJSON(flowDetails)
                .then(removeFromflowIdList)
                .then(removeFromManifest)
                .then(customNodeInstaller.removeFromPackage)
                .then(createNewCombinedFlow)
                .then((flowDetails) => {
                    fs.emptyDir(logFolder);
                    resolve(flowDetails);
                }).catch((error) => {
                    console.log(error);
                    reject(error);
                });
        } else {
            console.log("Warning: App not having entry in manifest..");
            reject("Warning: App not having entry in manifest..")
        }
    });
}
//Since same steps are used in addFlow and flowInstaller, made a common class
let doInstallation = (flowDetails, cb) => {
    checkValidJson(flowDetails)
        .then((flowDetails) => {
            if (flowDetails.customNodeDir) {
                customNodeInstaller.addToPackage(flowDetails)
                    .then(commonPromises)
                    .then(() => {
                        cb();
                    }).catch((err) => {
                        cb(err);
                    })
            } else {
                commonPromises(flowDetails)
                    .then(() => {
                        cb();
                    }).catch((err) => {
                        cb(err);
                    })
            }
        }).catch((err) => {
            cb(err);
        })
}
//get flow data of app, validates and collects disabled flow ids
let checkValidJson = (flowDetails) => {
    return new Promise((resolve, reject) => {
        try {
            flowDetails.flowData = fs.readJsonSync(flowDetails.path);
            if (typeof flowDetails.flowData.length == "undefined") {
                reject("Error : Invalid FlowFile : " + flowDetails.path);
            } else if (flowDetails.flowData.length == 0) {
                reject("Error : FlowFile is empty : " + flowDetails.path);
            } else {
                flowDetails.disabled = [];
                flowDetails.alwaysDisabled = [];
                flowDetails["data-injector-keys"] = [];
                flowDetails["data-injector-map"] = [];
                flowDetails["data-publisher-keys"] = [];
                flowDetails["data-publisher-map"] = [];
                flowDetails["flowIdList"] = {};
                flowDetails["flowIdList"][flowDetails.packageId] = {};
                // add the key here
                flowDetails.flowData.forEach((node, index, array) => {
                    let newId = flowDetails.packageId + "_" + node.id;
                    flowDetails.flowData[index].id = newId;
                    if (node.type == "tab") {
                        flowDetails["flowIdList"][flowDetails.packageId][newId] = node;
                        if (node.disabled) {
                            flowDetails.disabled.push(node.id);
                        }
                        if (node.disabled === null) {
                            node.disabled = true;
                            flowDetails.alwaysDisabled.push(node.id);
                        }
                    }
                    if (node.z && node.z != "") {
                        flowDetails.flowData[index].z = flowDetails.packageId + "_" + node.z;
                    }
                    if (node.wires) {
                        for (let i = 0, iMax = node.wires.length; i < iMax; i++) {
                            for (let j = 0, jMax = node.wires[i].length; j < jMax; j++) {
                                flowDetails.flowData[index].wires[i][j] = flowDetails.packageId + "_" + node.wires[i][j];
                            }
                        }
                    }
                    if (node.type === "data-inject") {
                        node.appid = flowDetails.packageId;
                        flowDetails["data-injector-keys"].push(flowDetails.packageId + "_" + node.key);
                        flowDetails["data-injector-map"].push(node.z);
                    }
                    if (node.type === "data-publish") {
                        node.appid = flowDetails.packageId;
                        flowDetails["data-publisher-keys"].push(flowDetails.packageId + "_" + node.key);
                        flowDetails["data-publisher-map"].push(node.z);
                    }
                    if (index == array.length - 1) {
                        resolve(flowDetails);
                    }
                });
            }
        } catch (e) {
            reject("Error : Invalid Path or flowFile : " + flowDetails.path);
        }
    });
}
//used in doInstallation
let commonPromises = (flowDetails) => {
    return new Promise((resolve, reject) => {
        createJSON(flowDetails)
            .then(addToflowIdList)
            .then(addToManifest)
            .then(createNewCombinedFlow)
            .then((flowDetails) => {
                resolve(flowDetails);
            }).catch((error) => {
                reject(error);
            });
    });
}
//create new json out of flow data in .nodered/allFlows directory with appId as name
let createJSON = (flowDetails) => {
    return new Promise((resolve, reject) => {
        let allPath = userDir + '/allFlows/' + flowDetails.packageId + ".json";
        if (writeJSONToDiskSync(allPath, flowDetails.flowData)) {
            resolve(flowDetails);
        } else {
            reject("Error : Failed to create a json : " + allPath);
        }
    });
}
//will remove "appId".json from .nodered/allFlows directory
let removeJSON = (flowDetails) => {
    console.log("removeJSON : packageId : " + flowDetails.packageId);
    return new Promise((resolve, reject) => {
        let allPath = userDir + '/allFlows/' + flowDetails.packageId + ".json";
        fs.pathExists(allPath).then(exists => {
            if (exists) {
                fs.unlink(allPath, (err) => {
                    if (err) {
                        reject("Error : App not exists in allFlows folder :" + flowDetails.packageId);
                    } else {
                        resolve(flowDetails);
                    }
                });
            } else {
                reject("Error : App not exists in allFlows folder :" + flowDetails.packageId);
            }
        });
    });
}
//reads existing MANIFEST_FILE in .nodered dir, add new entry of installed app and saves
let addToflowIdList = (flowDetails) => {
    return new Promise((resolve, reject) => {
        let fileName = userDir + "/" + FLOW_ID_LIST_FILE;
        let file = {};
        let appName = flowDetails.packageId; //"appId" is used as manifest property
        try {
            file = fs.readJsonSync(fileName);
        } catch (e) {
            file = {};
        }
        file[appName] = flowDetails["flowIdList"][appName];
        if (writeJSONToDiskSync(fileName, file)) {
            resolve(flowDetails);
        } else {
            reject("Error : Failed to create a json : " + allPath);
        }
    });
}

//reads manifest file in .nodered dir removes uninstalled app entry and saves
let removeFromflowIdList = (flowDetails) => {
    return new Promise((resolve, reject) => {
        let fileName = userDir + "/" + FLOW_ID_LIST_FILE;
        let file = fs.readJsonSync(fileName);
        let appName = flowDetails.packageId;
        if (file[appName]) {
            delete file[appName];
            if (writeJSONToDiskSync(fileName, file)) {
                resolve(flowDetails);
            } else {
                reject("Error : Failed to create a json : " + allPath);
            }
        } else {
            reject("Error : No entry in flowIdList file found...");
        }
    });
}
//reads existing MANIFEST_FILE in .nodered dir, add new entry of installed app and saves
let addToManifest = (flowDetails) => {
    return new Promise((resolve, reject) => {
        let fileName = userDir + "/" + MANIFEST_FILE;
        let file = {};
        let appName = flowDetails.packageId; //"appId" is used as manifest property
        try {
            file = fs.readJsonSync(fileName);
        } catch (e) {
            file = {};
        }
        file[appName] = {
            "appId": flowDetails.packageId,
            "disabled": flowDetails.disabled, // used for enabling and disabling flow
            "alwaysDisabled": flowDetails.alwaysDisabled,
            "data-injector-keys": flowDetails["data-injector-keys"],
            "data-injector-map": flowDetails["data-injector-map"],
            "data-publisher-keys": flowDetails["data-publisher-keys"],
            "data-publisher-map": flowDetails["data-publisher-map"]
        };
        if (flowDetails.customNodeDir) {
            file[appName].customNodes = flowDetails.nodeNames;
        }
        if (writeJSONToDiskSync(fileName, file)) {
            resolve(flowDetails);
        } else {
            reject("Error : Failed to create a json : " + allPath);
        }
    });
}
//reads manifest file in .nodered dir removes uninstalled app entry and saves
let removeFromManifest = (flowDetails) => {
    return new Promise((resolve, reject) => {
        let fileName = userDir + "/" + MANIFEST_FILE;
        let file = fs.readJsonSync(fileName);
        let appName = flowDetails.packageId;
        if (file[appName]) {
            if (file[appName].customNodes) {
                flowDetails.nodeNames = file[appName].customNodes;
            }
            delete file[appName];
            if (writeJSONToDiskSync(fileName, file)) {
                resolve(flowDetails);
            } else {
                reject("Error : Failed to create a json : " + allPath);
            }
        } else {
            reject("Error : No entry in manifest file found...");
        }
    });
}
//its common flow for both installed and removed flow, also called whenever service starts,
// to create new flows.json from app flows present in .nodered/allFlows directory
let createNewCombinedFlow = (flowDetails) => {
    return new Promise((resolve, reject) => {
        concatFlows(flowDetails)
            .then(backupAllFlowFile)
            .then(allFlowsFileAction.createAllFlowFile) //called from allFlowFileCreator.js
            .then((flowDetails) => {
                allFlowsFileAction.restartFlows(Red, flowDetails) //called from allFlowFileCreator.js
                    .then((flowDetails) => {
                        resolve(flowDetails);
                    })
                    .catch((error) => {
                        reject(error);
                    });
            })
            .catch((error) => {
                reject(error);
            });
    });
}
//reads .nodered/allFlows directory concat all flows into single json.
let concatFlows = (flowDetails) => {
    return new Promise((resolve, reject) => {
        let allPath = userDir + '/allFlows/';
        let allFlows = [];
        try {
            let flows = fs.readdirSync(allPath);
            if (flows && flows.length > 0) {
                let itemsProcessed = 0;
                let appid,
                    manifestFilePath = userDir + "/" + MANIFEST_FILE,
                    manifestObj = {};
                try {
                    manifestObj = fs.readJsonSync(manifestFilePath);
                } catch (e) {
                    manifestObj = {};
                }
                let flowIdListPath = userDir + "/" + FLOW_ID_LIST_FILE,
                    flowIdListObj = {};
                try {
                    flowIdListObj = fs.readJsonSync(flowIdListPath);
                } catch (e) {
                    flowIdListObj = {};
                }
                flows.forEach((flow, index, array) => {
                    appid = flow.replace(".json", "");
                    let obj = fs.readJsonSync(allPath + flow)
                    if (obj != null) {
                        let disabledArr, alwaysDisabledArr;
                        if (flowIdListObj[appid] && manifestObj[appid]) {
                            disabledArr = manifestObj[appid].disabled;
                            alwaysDisabledArr = manifestObj[appid].alwaysDisabled;
                            for (let f = 0, fMax = obj.length; f < fMax; f++) {
                                if (obj[f].type === "tab") {
                                    let alwaysDisabledIndex = alwaysDisabledArr.indexOf(obj[f].id),
                                        disabledIndex = disabledArr.indexOf(obj[f].id);
                                    if (flowIdListObj[appid][obj[f].id] && flowIdListObj[appid][obj[f].id]) {
                                        let tabData = flowIdListObj[appid][obj[f].id];
                                        if (tabData.disabled === null) { // always disabled
                                            obj[f].disabled = true;
                                            if (disabledIndex > -1) disabledArr.splice(disabledIndex, 1);
                                            if (alwaysDisabledIndex < 0) alwaysDisabledArr.push(obj[f].id);
                                        } else if (tabData.disabled === true) { // on app launch
                                            obj[f].disabled = true;
                                            if (alwaysDisabledIndex > -1) alwaysDisabledArr.splice(alwaysDisabledIndex, 1);
                                            if (disabledIndex < 0) disabledArr.push(obj[f].id);
                                        } else {
                                            obj[f].disabled = tabData.disabled;
                                            if (disabledIndex > -1) disabledArr.splice(disabledIndex, 1);
                                            if (alwaysDisabledIndex > -1) alwaysDisabledArr.splice(alwaysDisabledIndex, 1);
                                        }
                                    }
                                }
                            }
                            manifestObj[appid].disabled = disabledArr;
                            manifestObj[appid].alwaysDisabled = alwaysDisabledArr;
                            allFlows = allFlows.concat(obj);
                        }
                    } else {
                        console.log('Error : Invalid flowFile', flow);
                    }
                });
                flowDetails.allFlows = allFlows;
                if (writeJSONToDiskSync(manifestFilePath, manifestObj)) {
                    resolve(flowDetails);
                } else {
                    reject("Error : create concatFlows");
                }
            } else {
                flowDetails.allFlows = []; //if no flows exists then pass empty array
                resolve(flowDetails);
            }
        } catch (e) {
            reject("Error : concatFlows failed due to ", e);
        }
    });
}
//whenever a new app installed or removed backup existing combined flows, as precoution
let backupAllFlowFile = (flowDetails) => {
    return new Promise((resolve, reject) => {
        let srcpath = userDir + "/" + flowFile;
        flowDetails.flowFilePath = srcpath;
        if (typeof flowDetails.packageId == "undefined") {
            //This is added in assumption that if we need to create combined flow with existing
            //flow files in allFlows directory, without packageId
            resolve(flowDetails);
        } else {
            let dstpath = userDir + "/flowFileBackup/allFlowsBkp.json";
            fs.pathExists(srcpath).then(exists => {
                if (exists) {
                    fs.move(srcpath, dstpath, {
                        overwrite: true
                    }, err => {
                        if (err) console.log(err);
                        resolve(flowDetails);
                    })
                } else {
                    resolve(flowDetails);
                }
            });
        }
    });
}
//used in main.js
module.exports = {
    subscribe: subscribe,
    getAllFlows: createNewCombinedFlow,
    flowInstaller: flowInstaller
}