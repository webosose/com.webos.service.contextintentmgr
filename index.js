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

const Logger = require('./util/logger').Logger,
    WebosService = require("webos-service"),
    _package = require('./package.json'),
    RED = require("node-red"),
    flowInstaller = require("./src/flowInstaller.js"),
    cimApi = require("./src/cimApi.js"),
    restrictMode = require("./src/restrictMode");

process.title = "contextintentmgr";
let logger = new Logger(process.title);
let settings = {
    SKIP_BUILD_CHECK: true,
    logging: {
        console: {
            level: "info", // if logs are need change it "info"
            metrics: false,
            audit: false
        }
    },
    userDir: process.userDir, // userDir is set to /var/cim/.nodered
    functionGlobalContext: {},
    httpAdminRoot: false,
    httpNodeRoot: false,
    flowFile: 'flows.json',
    LOG: logger
};

RED.init(undefined, settings);

RED.start().then(() => {
    console.log("<<<<<<<<<<<<<<<<<<<<< REGISTER SERVICE >>>>>>>>>>>>>>>>>>>>");
    process.service = new WebosService(_package.name);
    restrictMode.init();// Added to block child process
    cimApi.initApi(RED); // All routs are required here
    flowInstaller.subscribe(RED); // Subscribe for appInstallService for merging flows of all apps.
});

let stopAi = () => {
    process.service.call("luna://com.webos.service.ai.voice/stop", {
        "mode": "continuous",
        "keywordDetect": true
    });
};

process.on('uncaughtException', (err) => {
    console.log("Error:uncaughtException ", err);
    stopAi();
    process.exit(1);
});

process.on('SIGINT', () => {
    stopAi();
    RED.stop().then(() => {
        process.exit();
    });
});