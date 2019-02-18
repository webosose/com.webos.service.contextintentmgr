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

var child_process = require('child_process');

module.exports = {
    init: () => {
        console.log("restrictMode init");
        // Blocking "process" prohibted methods i.e. kill, _kill, abort
        process._kill = process.kill = process.abort = function () {
            throw new Error("Function call process.kill(), process._kill(), process.abort() is prohibited in this environment.");
        };
        // Blocking restrictedCommands from child_processes in node-red flows
        child_process.fork = child_process._forkChild
            = child_process.execFile = child_process.spawn
            = child_process.spawnSync = child_process.execFileSync
            = child_process.execSync = child_process.exec = function () {
                throw new Error("Function call to child_process is prohibited in this environment.");
            };
    }
}