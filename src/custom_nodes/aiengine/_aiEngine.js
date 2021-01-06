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

var _engineMap = {
    "voice": {
        "mode": "continuous",
        "keywordDetect": true
    }
};
var subscribeCall = (server, callback) => {
    try {
        let params = {
            "subscribe": true
        },
            subscriptionAIx = process.service.subscribe('luna://com.webos.service.ai.' + server.engine + '/getResponse', params);
        subscriptionAIx.on("response", (res) => {
            if (res.payload && res.payload.response && !res.payload.response.hasOwnProperty('partial')) {
                callback(res);
            }
        });
        subscriptionAIx.on("cancel", (badRes) => {
            if (badRes.payload && badRes.payload.badPayload) {
                let payload = badRes.payload.badPayload.replace(/\r?\n|\r/g, " ");
                payload = JSON.parse(payload);
                subscribeCall(server, callback);
                callback({ "payload": payload });
            }
        });
    } catch (e) {
        console.log("Subscribing to service failed [raw Data]", e);
    }
};
module.exports = class engineLogic {
    constructor(service, config, engine) {
        this.service = service;
            this.engine = engine;
            this.config = config;
    }
    startAIEngine() {
        return new Promise(function (resolve, reject) {
            process.service.call("luna://com.webos.service.ai." + this.engine + "/start",
                _engineMap[this.engine], (response) => {
                    if (response) {
                        resolve("success");
                    } else {
                        reject("Start call to service failed");
                    }
                });
        }.bind(this));
    }
    subscribeEngine(callback) {
        subscribeCall(this, callback);
    }
};