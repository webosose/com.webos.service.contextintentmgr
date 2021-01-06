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

let getFormattedLog = (isError, msg, isFinal) => {
    let isoDt = (new Date()).toISOString(),
        title = isError ? "[ERROR]" : "[SUCCESS]";
    if (isFinal) return msg;
    if (typeof msg != "object") {
        msg = isoDt + "_" + title + "-->" + String(msg);
    } else {
        try {
            msg = isoDt + "_" + title + "-->" + JSON.stringify(msg, null, 2);
        } catch (e) {
            msg = isoDt + "_" + title + "-->" + msg;
        }
    }
    return msg;
};

let logToPath = (logPath, isError, msg, isFinal) => {
    let _msg = getFormattedLog(isError, msg, isFinal);
    fs.appendFile(logPath, _msg, function (err) {
        if (err) console.log("appendFile Failed", err);
        return true;
    });
};

module.exports = {
    logToPath: logToPath,
    getFormattedLog: getFormattedLog
};