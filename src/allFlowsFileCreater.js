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

const fs = require("fs-extra");

//creates flows.json file
let createAllFlowFile = (details) => {
    console.log('createAllFlowFile');
    return new Promise((resolve, reject) => {
        fs.outputJson(details.flowFilePath, details.allFlows, err => {
            if (err) {
                reject("Error : Failed to create allFlows json file ");
            } else {
                resolve(details);
            }
        });
    });
}
//restarts flows by setFlow method
let restartFlows = (Red, details) => {
    console.log('restartFlows');
    return new Promise((resolve, reject) => {
        if (details.nodeNames && details.installer) {
            reject("TV needs to restart after customnodes installed");
        } else {
            Red.nodes.setFlows(details.allFlows, "flows");
            resolve(details);
        }
    });
}
//restarts nodes by setFlow method
let restartNodes = (Red, details) => {
    console.log('restartNodes');
    return new Promise((resolve, reject) => {
        Red.nodes.setFlows(details.allFlows, "node");
        resolve(details);
    });
}
//used in flowsEnabler.js,flowInstaller.js
module.exports = {
    "createAllFlowFile": createAllFlowFile,
    "restartNodes": restartNodes,
    "restartFlows": restartFlows
}