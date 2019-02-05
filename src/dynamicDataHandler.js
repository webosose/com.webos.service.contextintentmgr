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

const MANIFEST_FILE = "manifest.json",
    fs = require("fs-extra"),
    _pubsub = require("./pubsub"),
    flowEnabler = require("./flowEnabler");

var getClass = function (obj) {
    if (typeof obj === "undefined")
        return "undefined";
    if (obj === null)
        return "null";
    return Object.prototype.toString.call(obj)
        .match(/^\[object\s(.*)\]$/)[1];
};

// msg.payload should contain proper values like appid, key, data
// e.g. {
//    "appid": "com.lg.app.cimdemo",
//    "key": "fb7e572a.775cd8_546348d0.00d698",
//    "data": "{MUST BE AN OBJECT}",
// }
var validateInput = (input, appId, api_type) => {
    return new Promise((resolve, reject) => {
        let manifestPath = input.userDir + "/" + MANIFEST_FILE,
            manifestFile = fs.readJsonSync(manifestPath),
            appManifest,
            apiCategory = "data-" + api_type + "-keys",
            apiMap = "data-" + api_type + "-map",
            requestKey = "";
        try {
            appManifest = manifestFile[appId];
            if (appManifest) {
                requestKey = appId + "_" + input.key;
                let keyIndex = appManifest[apiCategory].indexOf(requestKey);
                if (appManifest.alwaysDisabled.indexOf(appManifest[apiMap][keyIndex]) > -1) {
                    reject("Associated flow is disabled, calls to APIs does not work");
                }
                if (keyIndex > -1) {
                    input.subscriptionKey = requestKey;
                    if (apiCategory === "injector") {
                        let data = JSON.parse(input.data);
                        if (getClass(data) === "Object") {
                            resolve(input);
                        } else {
                            reject("Not a JSON data in the data-inject request.");
                        }
                    } else {
                        resolve(input);
                    }
                } else {
                    reject("Caller does not have permission for this API.");
                }
            } else {
                reject("Caller does not have permission for this API.");
            }
        } catch (e) {
            reject("Invalid call to API : " + e.message);
        }
    });
};

var publishDataForInjection = (input) => {
    return new Promise((resolve, reject) => {
        try {
            _pubsub.publish(input.subscriptionKey, input);
            resolve({ "data": input.data });
        } catch (e) {
            reject("Could not inject data: " + e.message);
        }
    });
};

var dataInjector = (input, appId, callback) => {
    validateInput(input, appId, "injector")
        .then(publishDataForInjection)
        .then((result) => {
            callback({
                "returnValue": true,
                "result": result
            })
        }).catch(err => {
            callback({
                "returnValue": false,
                "errorCode": 0,
                "errorText": err
            })
        });
};

var dataPublisher = (input, appId, callback) => {
    validateInput(input, appId, "publisher")
        //.then(subscribeForPublishData)
        .then((result) => {
            flowEnabler.setPublisherAppId(appId);//This is added, to disable pubsub on app close
            _pubsub.subscribe(input.subscriptionKey, (key, data) => {
                let result = {
                    "data": data
                };
                callback({
                    "returnValue": true,
                    "result": result
                });
            });
        }).catch(err => {
            callback({
                "returnValue": false,
                "errorCode": 0,
                "errorText": err
            })
        });
};

module.exports = {
    dataInjector: dataInjector,
    dataPublisher: dataPublisher
}