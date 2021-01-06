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

const dynamicDataHandler = require("./dynamicDataHandler.js");

let initApi = (RED) => {
    // Data injection API in to a flow, from an app
    process.service.register("injectDataToWorkflow", (message) => {
        message.payload.userDir = RED.settings.userDir;
        dynamicDataHandler.dataInjector(message.payload, message.sender, (result) => {
            message.respond(result);
        });
    });

    // Data publisher API from a flow, to an app
    process.service.register("getDataFromWorkflow", (message) => {
        message.payload.userDir = RED.settings.userDir;
        dynamicDataHandler.dataPublisher(message.payload, message.sender, (result) => {
            result.subscribed = message.isSubscription;
            message.respond(result);
        });
    });
};
//used in index.js
module.exports = {
    initApi: initApi
};